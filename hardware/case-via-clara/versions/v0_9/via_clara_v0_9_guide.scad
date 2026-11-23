// VIA Clara v0.9 — annotated assembly guide: arrows and labels saying what each part, slot and hole
// is for. Renders to images (see export.sh); it is not a printable part.
// Labels are in Spanish because people read them; the code is in English (ADR 0009).
//
// VIEW = outer | head | left_inside | right_inside | exploded
// Render with an orthographic projection and the eye along view_dir(VIEW), for example:
//   openscad -D 'PART="none"' -D 'VIEW="head"' --projection=o --camera=<eye>,<center> ... via_clara_v0_9_guide.scad

// Always render with -D 'PART="none"' (export.sh does): the model's own dispatch must draw nothing.
// Setting PART here would not work, because the included file reassigns it.
include <via_clara_v0_9.scad>

VIEW = "head";                   // set with -D
// export.sh renders the parts once to meshes in the model frame and passes their folder here: preview
// mode draws imported meshes cleanly, while the parts' many CSG cuts are too much for it
MESH_DIR = "";                   // set with -D by export.sh
module part(name) {
    if (MESH_DIR != "") import(str(MESH_DIR, "/", name, ".stl"));
    else if (name == "left") left_body();
    else if (name == "right") right_body();
    else if (name == "button") button_cap_placed();
    else if (name == "slider") power_slider();
    else if (name == "bone") bone_arm();
}
TEXT_SIZE = 2.3;
LABEL_DIST = 45;                 // labels float this far toward the viewer, in front of every face, so arrows stay visible

// Eye direction of each view (from the model toward the camera). export.sh uses the same vectors.
function view_dir(v) =
    v == "outer" ? [0.35, 1, 0.45] :
    v == "head" ? [-0.35, -1, 0.4] :
    v == "left_inside" ? [0.12, 1, 0.55] :
    v == "right_inside" ? [0.12, -1, 0.55] :
    [0.25, -0.55, 1];            // exploded

function unit(v) = v / norm(v);

// ---------- Labels that always face the camera ----------
// A rotation that maps the text plane (XY, normal +Z) onto the view: X to screen-right, Y to screen-up.
function view_frame(d) =
    let (f = unit(d), r = unit(cross([0, 0, 1], f)), u = cross(f, r)) [r, u, f];

module facing(p, d) {
    m = view_frame(d);
    multmatrix([[m[0][0], m[1][0], m[2][0], p[0]],
                [m[0][1], m[1][1], m[2][1], p[1]],
                [m[0][2], m[1][2], m[2][2], p[2]],
                [0, 0, 0, 1]]) children();
}

// ---------- Callout layout ----------
// Each view lists [anchor, text]. Anchors left of the view centre get their label in a left column,
// the rest in a right column; within a column labels are sorted by height and pushed apart so they
// never overlap. Arrows run from the label to the anchor.
CENTER_X = 12;                   // export.sh overrides it (-D) to centre each view on what it shows
CENTER = [CENTER_X, 0, -2];
LINE = TEXT_SIZE * 2.2;

function sx(p, d) = (p - CENTER) * view_frame(d)[0];
function sy(p, d) = (p - CENTER) * view_frame(d)[1];
// sort [key, item] pairs by key, highest first
function qsort(a) = len(a) <= 1 ? a :
    let (p = a[0][0]) concat(qsort([for (e = a) if (e[0] > p) e]), [for (e = a) if (e[0] == p) e], qsort([for (e = a) if (e[0] < p) e]));
// push labels down so consecutive ones are at least LINE apart: returns the label heights
function spread(ys, i = 0, prev = 1e9) = i >= len(ys) ? [] :
    let (y = min(ys[i], prev - LINE)) concat([y], spread(ys, i + 1, y));

module column(items, side, col_x, d) {
    m = view_frame(d);
    sorted = qsort([for (it = items) [sy(it[0], d), it]]);
    heights = spread([for (e = sorted) e[0]]);
    // centre the column on the anchors it serves
    shift = len(heights) == 0 ? 0 : ((sorted[0][0] + sorted[len(sorted) - 1][0]) - (heights[0] + heights[len(heights) - 1])) / 2;
    for (i = [0 : len(sorted) - 1]) {
        anchor = sorted[i][1][0];
        label = CENTER + m[0] * col_x + m[1] * (heights[i] + shift) + m[2] * LABEL_DIST;
        u = unit(anchor - label);
        tip = 2.2;
        color("#c62828") {
            hull() { translate(label) sphere(r = 0.2, $fn = 8); translate(anchor - u * tip) sphere(r = 0.2, $fn = 8); }
            hull() { translate(anchor) sphere(r = 0.05, $fn = 8); translate(anchor - u * tip) sphere(r = 0.7, $fn = 12); }
            translate(label) sphere(r = 0.45, $fn = 12);
        }
        color("#5d0000") facing(label + m[0] * side * 1.2, d)
            linear_extrude(0.2) text(sorted[i][1][1], size = TEXT_SIZE, font = "Liberation Sans:style=Bold",
                                     halign = side < 0 ? "right" : "left", valign = "center");
    }
}

module callouts_layout(items, d) {
    xs = [for (it = items) sx(it[0], d)];
    half = max(concat([for (x = xs) abs(x)], [48]));   // never closer than the body's half-length
    column([for (it = items) if (sx(it[0], d) < 0) it], -1, -half - 10, d);
    column([for (it = items) if (sx(it[0], d) >= 0) it], 1, half + 10, d);
}

// ---------- Scenes ----------
module scene(v) {
    if (v == "outer" || v == "head") {
        color("#6a6a6a") part("left");
        color("#8a8a8a") part("right");
        color("#d9d9d9") part("button");
        color("#d0a020") part("slider");
        color("#1b1b1b") part("bone");
    } else if (v == "left_inside") {
        color("#a8a8a8") part("left");
        color("#d0a020") part("slider");
    } else if (v == "right_inside") {
        color("#b0b0b0") part("right");
        color("#f0f0f0") part("button");
    } else {
        color("#8a8a8a") translate([0, -30, 0]) part("left");
        color("#a0a0a0") translate([0, 30, 0]) part("right");
        color("#d9d9d9") translate([0, 30, 0]) part("button");
        color("#d0a020") translate([0, -16, 0]) part("slider");
        color("#1b1b1b") translate([0, -30, 0]) part("bone");
        color([.15, .35, .8]) hw_hat();
        color([.1, .55, .2]) hw_pi();
        color([.2, .2, .25]) translate([0, 0, 0]) hw_camera();
        color("white") translate([0, 16, 0]) hw_switch();
    }
}

// ---------- What each view points at ----------
function items(v) =
    let (sxk = (SLIDER_X[0] + SLIDER_X[1]) / 2, t = SNAPS[1])
    v == "outer" ? [
        [[BUTTON_X, RIGHT_FACE + 0.8, BUTTON_Z], "Botón de modos"],
        [[BUTTON_X + 5.2, RIGHT_FACE - 0.3, BUTTON_Z - 1.5], "Anillo para encontrar el botón"],
        [[STACK_REAR_X + 6, HAT_TOP_Y + 1.5, (USB_Z[0] + USB_Z[1]) / 2], "Carga (micro USB)"],
        [[40.5, 0, -4], "Ranura para abrir"],
        [[-20, 0, 18.6], "Junta entre mitades"],
        [[NOSE_X + 1, 8, LENS_Z + 6], "Nariz: cámara adentro"],
        [TRANSDUCER_CENTER + [0, 0, 8], "Brazo del auricular"]] :
    v == "head" ? [
        [[sxk, LEFT_FACE - 1.5, SLIDER_KNOB_C + SLIDER_S], "Perilla ON/OFF (arriba = OFF)"],
        [[sxk, LEFT_FACE - 0.6, SLIDER_W0 - 1.6], "Punto en relieve = lado ON"],
        [[NOSE_X, 0, LENS_Z], "Lente de la cámara"],
        [[ELASTIC_XS[0], LEFT_FACE - 3.8, 0], "Puente para el elástico"],
        [[ELASTIC_XS[1], LEFT_FACE - 3.8, 0], "Puente para el elástico"],
        [[29, LEFT_FACE - 3.8, 4], "Zócalo del brazo"],
        [TRANSDUCER_CENTER + [0, -4, 0], "Transductor óseo (14 mm)"],
        [[-2, LEFT_FACE, 12], "Cara que apoya en la patilla"]] :
    v == "left_inside" ? [
        [[PI_CX - PI_HOLE_X, PAD_TOP_Y + 0.8, PI_HOLE_Z], "Almohadilla: separador de bronce (x4)"],
        [[PI_CX + PI_HOLE_X, PAD_TOP_Y + 0.8, -PI_HOLE_Z], "Collar que se derrite con el soldador"],
        [[CAM_FRONT_X - 0.4, -AI_CAM_W / 2, 9], "Ranura del PCB de la cámara"],
        [[-36.5, -4, -13.8], "Recorrido libre del flex"],
        [[sxk, -CHAMBER_HY + 1, SLIDER_KNOB_C + SLIDER_S - 5], "Corredera: agarra la palanca de la llave"],
        [[29, -CAV_HY, -0.5], "Paso del cable del auricular"],
        [[STACK_REAR_X + 1.5, PI_TOP_Y + 0.5, SD_ZC], "Hueco interno de la microSD"],
        [[STACK_REAR_X + 3, HAT_TOP_Y + 1.5, -6.5], "Canal de carga"],
        [[-12, -2, CAV_HZ + 1.2], "Ranura donde engancha la traba"],
        [[38.6, -1.5, 12.5], "Agujero del perno"]] :
    v == "right_inside" ? [
        [[snap_root(t) + 4, 1.2, t[2] + 0.6], "Viga de la traba (flexiona)"],
        [[t[0], -HOOK_LEN + 0.5, t[2] + SNAP_T + 0.3], "Gancho de la traba"],
        [[snap_free(t) + 0.4, SNAP_DEPTH + 0.3, t[2] + 0.6], "Puente a cortar tras imprimir"],
        [[BUTTON_X, BACKING_Y, BUTTON_Z], "Cajón del pulsador"],
        [[BUTTON_X, CAV_HY, BUTTON_Z - 11], "Canal: suben tecla y pulsador"],
        [[-38.5, 1, 0], "Nervios de la cámara"],
        [[38.6, -2.6, -12.5], "Perno de alineación"],
        [[0, -1.2, -CAV_HZ - 0.6], "Labio de alineación"]] :
    [
        [[-42.4, 0, 12], "AI Camera"],
        [[hat_x(26), HAT_TOP_Y + 4, 15], "UPS HAT + batería"],
        [[STACK_REAR_X - 20, PI_TOP_Y, 15], "Raspberry Pi Zero 2 W"],
        [[sxk, -16 - 9, SLIDER_KNOB_C + 4], "Corredera (pieza 05)"],
        [[BUTTON_X, 30 + SW_TOP_Y + 1, BUTTON_Z + 3.5], "Tecla (pieza 04)"],
        [[BUTTON_X, 16 + SW_BASE_Y + 1, BUTTON_Z + 3], "Pulsador 6 x 6"],
        [[0, -30 + LEFT_FACE + 2, 18], "Mitad izquierda (cabeza)"],
        [[0, 30 + RIGHT_FACE - 2, 18], "Mitad derecha (externa)"],
        [TRANSDUCER_CENTER + [0, -30, 8], "Brazo del auricular (pieza 03)"]];

scene(VIEW);
callouts_layout(items(VIEW), view_dir(VIEW));
