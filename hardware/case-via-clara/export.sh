#!/usr/bin/env bash
# Regenerates stl/ (print-oriented parts + assembled model) and img/, then runs the
# interference checks: every check must come out empty or the script exits non-zero.
set -euo pipefail
cd "$(dirname "$0")"
SCAD=via_clara_v0_9.scad
OS=(openscad -q --backend=manifold --export-format=binstl)
rm -rf stl img && mkdir -p stl img

parts=(print_left:01_left_half print_right:02_right_half print_bone:03_bone_arm
       print_button:04_mode_button print_slider:05_power_slider assembly:00_assembly_check)
for p in "${parts[@]}"; do
  part=${p%%:*}; name=${p#*:}
  "${OS[@]}" -D "PART=\"$part\"" -D 'SHOW_HW=false' -o "stl/${name}_v0_9.stl" "$SCAD" &
done
wait

views=("assembly:0,0,0,62,0,215,200:-D SHOW_HW=false:closed_outer"
       "assembly:0,0,0,62,0,35,200:-D SHOW_HW=false:closed_head_side"
       "assembly:0,0,0,70,0,200,200:-D EXPLODE=22:exploded_with_hardware"
       "left:0,0,0,90,0,180,200::left_half_inside"
       "right:0,0,0,90,0,0,200::right_half_inside")
for v in "${views[@]}"; do
  IFS=: read -r part cam def name <<<"$v"
  # shellcheck disable=SC2086
  openscad -q --backend=manifold --render -D "PART=\"$part\"" $def --camera="$cam" --viewall --autocenter \
    --imgsize=1100,750 --colorscheme=Tomorrow -o "img/$name.png" "$SCAD" &
done
wait

fail=0
for c in halves left_hw right_hw pads_heads button slider bone drawer_pi; do
  out=$(mktemp -t viaclara).stl
  log=$(openscad --backend=manifold --export-format=binstl -D "PART=\"check_$c\"" -o "$out" "$SCAD" 2>&1 || true)
  if [[ "$log" == *"top level object is empty"* ]]; then
    echo "ok    $c"
  else
    # the two halves share the parting plane: a zero-volume contact is expected there
    vol=$(python3 -I -c 'import sys,struct
d=open(sys.argv[1],"rb").read();n=struct.unpack("<I",d[80:84])[0];v=0
for i in range(n):
  f=struct.unpack("<9f",d[84+i*50+12:84+i*50+48]);a,b,c=f[0:3],f[3:6],f[6:9]
  v+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
print(f"{abs(v):.3f}")' "$out" 2>/dev/null || echo "?")
    if [[ "$vol" == "0.000" ]]; then echo "ok    $c (contact only)"; else echo "CLASH $c: ${vol} mm3"; fail=1; fi
  fi
  rm -f "$out"
done
exit $fail
