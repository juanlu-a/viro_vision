#!/usr/bin/env bash
# Regenerates stl/ (print-oriented parts + assembled model) and img/, then verifies the model:
#   - every printable part is a single solid;
#   - every interference check comes out empty (or a zero-volume contact).
# Exits non-zero if any export fails or any check does not pass.
set -euo pipefail
cd "$(dirname "$0")"
SCAD=via_clara_v0_20.scad
OS=(openscad -q --backend=manifold)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
rm -rf stl img && mkdir -p stl img img/guide

pids=()
run() { "$@" & pids+=($!); }
join() { local f=0; for p in "${pids[@]}"; do wait "$p" || f=1; done; pids=(); return $f; }

parts=(print_left:01_left_half print_right:02_right_half print_bone:03_bone_arm
       print_button:04_mode_button print_grille:07_transducer_cover assembly:00_assembly_check
       print_nose_left:test_nose_left print_nose_right:test_nose_right print_pads_test:test_pads print_hex_sizes:test_hex_sizes print_panel_switch_test:test_panel_switch)
for p in "${parts[@]}"; do
  run "${OS[@]}" --export-format=binstl -D "PART=\"${p%%:*}\"" -D 'SHOW_HW=false' -o "stl/${p#*:}_v0_20.stl" "$SCAD"
done
join || { echo "STL export failed"; exit 1; }

views=("assembly:0,0,0,62,0,215,200:-D SHOW_HW=false:closed_outer"
       "assembly:0,0,0,62,0,35,200:-D SHOW_HW=false:closed_head_side"
       "assembly:0,0,0,75,0,160,200:-D SHOW_HW=false:head_side_switch"
       "assembly:0,0,0,80,0,60,200:-D SHOW_HW=true:rear_openings"
       "assembly:0,0,0,70,0,200,200:-D EXPLODE=22:exploded_with_hardware"
       "left:0,0,0,90,0,180,200::left_half_inside"
       "right:0,0,0,90,0,0,200::right_half_inside")
for v in "${views[@]}"; do
  IFS=: read -r part cam def name <<<"$v"
  # shellcheck disable=SC2086
  run "${OS[@]}" --render -D "PART=\"$part\"" $def --camera="$cam" --viewall --autocenter \
    --imgsize=1100,750 --colorscheme=Tomorrow -o "img/$name.png" "$SCAD"
done
join || { echo "image export failed"; exit 1; }

# Annotated guide (img/guide/): arrows and labels for what each slot and hole is for. The parts are
# rendered once to model-frame meshes, which the guide imports (preview mode draws them cleanly).
mkdir -p img/guide "$tmp/mesh"
for m in left right button bone; do
  case $m in button) part=button_placed ;; *) part=$m ;; esac
  run "${OS[@]}" --export-format=binstl -D "PART=\"$part\"" -o "$tmp/mesh/$m.stl" "$SCAD"
done
join || { echo "guide mesh export failed"; exit 1; }
# view : eye direction : eye distance (sets the zoom) : X of the point the view centres on
guide_views=("outer:0.35,1,0.45:400:14" "head:-0.35,-1,0.4:400:14" "left_inside:0.12,1,0.55:380:2"
             "right_inside:0.12,-1,0.55:340:-4" "exploded:0.25,-0.55,1:480:10")
for g in "${guide_views[@]}"; do
  IFS=: read -r view dir scale cx <<<"$g"
  IFS=, read -r dx dy dz <<<"$dir"
  eye=$(python3 -I -c "import math;d=[$dx,$dy,$dz];n=math.sqrt(sum(c*c for c in d));print(','.join(f'{$cx+$scale*d[0]/n:.2f}' if i==0 else f'{$scale*d[1]/n:.2f}' if i==1 else f'{-2+$scale*d[2]/n:.2f}' for i in range(3)))")
  run openscad -q -D 'PART="none"' -D "VIEW=\"$view\"" -D "CENTER_X=$cx" -D "MESH_DIR=\"$tmp/mesh\"" --projection=o --camera="$eye,$cx,0,-2" \
    --imgsize=1800,1000 --colorscheme=Tomorrow -o "img/guide/$view.png" via_clara_v0_20_guide.scad
done
join || { echo "guide render failed"; exit 1; }

# STL helpers: signed volume, and number of connected solids (shared vertices)
stl_py='import sys,struct
d=open(sys.argv[2],"rb").read();n=struct.unpack("<I",d[80:84])[0]
tris=[struct.unpack("<9f",d[84+i*50+12:84+i*50+48]) for i in range(n)]
if sys.argv[1]=="zmin":
  print(f"{min(min(f[2],f[5],f[8]) for f in tris):.3f}")
elif sys.argv[1]=="vol":
  v=0
  for f in tris:
    a,b,c=f[0:3],f[3:6],f[6:9]
    v+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
  print(f"{abs(v):.3f}")
else:
  par={}
  def find(x):
    while par.setdefault(x,x)!=x: par[x]=par[par[x]]; x=par[x]
    return x
  for f in tris:
    ks=[tuple(round(c,4) for c in f[i:i+3]) for i in (0,3,6)]
    for k in ks[1:]: par[find(ks[0])]=find(k)
  print(len({find(k) for k in list(par)}))'

fail=0
for f in stl/*.stl; do
  [[ $f == *00_assembly_check* ]] && continue
  name=$(basename "$f" .stl)
  n=$(python3 -I -c "$stl_py" parts "$f")
  if [[ "$n" == "1" ]]; then echo "ok    $name is one solid"; else echo "FAIL  $name: $n separate solids"; fail=1; fi
  z=$(python3 -I -c "$stl_py" zmin "$f")
  if [[ "$z" =~ ^-?0\.0[0-4][0-9]$ ]]; then echo "ok    $name sits on the bed"; else echo "FAIL  $name: lowest point at z = $z"; fail=1; fi
done

checks=(halves left_hw right_hw pads_hex button panel_switch flex hw_self bone drawer_pi
        cap_insert switch_insert grille stack_insert clamp cam_insert)
for vc in "${checks[@]/#/integrated:}"; do
  variant=${vc%%:*}; c=${vc#*:}
  out="$tmp/$variant-$c.stl"
  rc=0; log=$(openscad --backend=manifold --export-format=binstl -D "VARIANT=\"$variant\"" -D "PART=\"check_$c\"" -o "$out" "$SCAD" 2>&1) || rc=$?
  c="$c ($variant)"
  if [[ "$log" == *ERROR* || "$log" == *WARNING* ]] || { (( rc != 0 )) && [[ "$log" != *"top level object is empty"* ]]; }; then
    # an assert (e.g. an unknown check name) also leaves an empty scene: it must not read as a pass
    echo "FAIL  $c: openscad error"; echo "$log" | grep -E "ERROR|WARNING" | head -3; fail=1
  elif [[ "$log" == *"top level object is empty"* ]]; then
    echo "ok    $c"
  elif [[ ! -s "$out" ]]; then
    echo "FAIL  $c: openscad error"; echo "$log" | tail -3; fail=1
  else
    # parts that share a face (the two halves, the button against its switch) give a zero-volume contact
    vol=$(python3 -I -c "$stl_py" vol "$out")
    if [[ "$vol" == "0.000" ]]; then echo "ok    $c (contact only)"; else echo "CLASH $c: ${vol} mm3"; fail=1; fi
  fi
done
exit $fail
