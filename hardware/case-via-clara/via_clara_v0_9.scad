// VIA Clara v0.9 — two-half snap-fit case for Raspberry Pi Zero 2 W + Waveshare UPS HAT (C)
// + Raspberry Pi AI Camera (IMX500) + bone-conduction transducer.
//
// Changes from v0.8 (see README.md for the reasoning):
//   - no external screws: the halves close with internal snap tabs + an alignment lip + two pins;
//   - no separate camera cap: the camera chamber is split between both halves, the PCB is captured
//     by edge ribs (no pegs through its holes) and there is a single front lens opening;
//   - the existing metal standoffs are heat-pressed into chassis pads BEFORE the boards go in
//     (no plastic pins through the Raspberry Pi holes, no heat on the boards);
//   - UPS HAT switch reachable through a window; two buttons (command + volume) with switch drawers;
//   - bone transducer pocket back to 14 mm nominal + explicit fit clearance.
//
// Units: mm. Frame: X along the temple (front = -X, camera end), Y across (left half / head side
// is Y < 0, right half / outer side is Y > 0, parting plane Y = 0), Z up.
// Values tagged MEASURE come from datasheets or from v0.8 and must be checked with a caliper.

$fn = $preview ? 40 : 64;
PART = is_undef(PART) ? "assembly" : PART;
SHOW_HW = is_undef(SHOW_HW) ? true : SHOW_HW;
EXPLODE = is_undef(EXPLODE) ? 0 : EXPLODE;

// ---------- Board stack: Pi Zero 2 W over the UPS HAT (C) ----------
PI_L = 65;
PI_W = 30;
PI_CX = 3.0;                    // stack centre along X (kept from v0.8)
PI_HOLE_X = 29.0;               // 58 mm pitch
PI_HOLE_Z = 11.5;               // 23 mm pitch
STACK_T = 16.5;                 // MEASURE: standoff tip to tallest top component (v0.8 value)
STANDOFF_AF = 5.0;              // MEASURE: across flats of the existing hex standoffs
STANDOFF_BELOW = 4.0;           // MEASURE: standoff length below the lowest board
STACK_FRONT_X = PI_CX - PI_L / 2;   // -29.5: CSI connector + UPS switch end
STACK_REAR_X = PI_CX + PI_L / 2;    //  35.5: microSD end

// ---------- Main cavity and walls ----------
CAV_W = 19.6;                   // Y
CAV_H = 31.8;                   // Z  -> half height 15.9 (PCB edge at 15.0)
CAV_L = 67.2;
CAV_HZ = CAV_H / 2;

// Melt pads: hex socket for the standoff + reflowable collar
PAD_D = 8.0;
PAD_TOP_Y = -7.0;
SOCKET_DEPTH = 2.2;
SOCKET_AF = STANDOFF_AF - 0.1;  // slight interference for heat-pressing
COLLAR_H = 0.8;
COLLAR_W = 0.8;
STACK_MIN_Y = PAD_TOP_Y - SOCKET_DEPTH;              // -9.2 (standoff tip)
STACK_BOARD_Y = STACK_MIN_Y + STANDOFF_BELOW;        // lowest board face
STACK_MAX_Y = STACK_MIN_Y + STACK_T;                 //  7.3

// ---------- Raspberry Pi AI Camera ----------
// Official product brief RP-008147: PCB 25 x 23.862; holes 21 x 12.5 apart, 2.0 from the top edge;
// lens centred across the width and 14.4 from the top edge (v0.8 assumed 12.5: MEASURE before printing).
// Optical block 12.8 x ~17.2, 3.1 deep; focus ring Ø9 x 4.2; barrel Ø5.75 reaching 7.0 from the PCB.
AI_CAM_W = 25.0;                // Y
AI_CAM_H = 23.862;              // Z, FPC connector on the bottom edge
AI_CAM_PCB_T = 1.0;
AI_CAM_LENS_FROM_TOP = 14.4;    // MEASURE
AI_CAM_BARREL_D = 5.75;
AI_CAM_BARREL_REACH = 7.0;
AI_CAM_RING_D = 9.0;
AI_CAM_RING_REACH = 4.2;
AI_CAM_BLOCK_W = 12.8;
AI_CAM_BLOCK_H = 17.2;
AI_CAM_BLOCK_TOP = 3.8;         // block starts 3.8 below the top edge
AI_CAM_BLOCK_REACH = 3.1;
AI_CAM_CONN_W = 16.0;
AI_CAM_CONN_H = 5.71;
AI_CAM_CONN_REACH = 3.8;
AI_CAM_HOLE_Y = 10.5;
AI_CAM_HOLE_Z = [AI_CAM_H / 2 - 2.0, AI_CAM_H / 2 - 14.5];
AI_CAM_HOLE_D = 2.2;

NOSE_X = -44.0;                 // front face of the case
CAM_FRONT_X = NOSE_X + 0.1 + AI_CAM_BARREL_REACH;    // PCB front face (-36.9): barrel flush with the nose
CAM_BACK_X = CAM_FRONT_X + AI_CAM_PCB_T;             // -35.9
LENS_Z = AI_CAM_H / 2 - AI_CAM_LENS_FROM_TOP;        // -2.47 with the board centred on Z = 0
LENS_HOLE_D = AI_CAM_BARREL_D + 0.65;

CHAMBER_FRONT_X = CAM_FRONT_X - AI_CAM_RING_REACH - 0.3;   // inner face of the front wall
CHAMBER_HY = AI_CAM_W / 2 + 0.9;                           // 13.4
CHAMBER_HZ = 14.6;
CHAMBER_R = 3.5;
CHAMBER_NECK_X = -34.6;          // behind the camera ribs the chamber narrows to the neck
CHAMBER_NECK_HY = 11.0;
RIB_T = 0.65;
RIB_GAP = 0.05;
RIB_OVERLAP = 0.8;               // how far the ribs overlap the PCB edge

// ---------- Snap fit ----------
LIP_T = 1.2;                     // lip / tab thickness (Z)
LIP_CLEAR = 0.2;
LIP_LEN = 2.5;                   // continuous alignment lip depth past the parting plane
TAB_LEN = 5.0;                   // snap tab depth past the parting plane
TAB_ROOT = 2.5;                  // tab root sits this far inside the right half (longer lever)
TAB_RELIEF = 0.5;
TAB_SLOT = 0.8;
BUMP_H = 0.35;
// [x centre, width, cavity half height under the tab]
TABS = [[-33.1, 3.8, CHAMBER_HZ], [-16.0, 9.0, CAV_HZ], [20.0, 9.0, CAV_HZ]];
LIP_SEGMENTS = [[-40.5, -35.6, CHAMBER_HZ], [-30.6, -21.3, CAV_HZ], [-10.7, 14.7, CAV_HZ], [25.3, 34.0, CAV_HZ]];
PIN_D = 2.4;
PIN_LEN = 2.6;
PIN_HOLE_D = 2.75;
PINS = [[38.6, -9.0], [38.6, 13.3]];   // rear wall, clear of the microSD opening

// ---------- Buttons: command + volume ----------
BUTTON_XS = [-5.5, 8.5];
BUTTON_Z = 2.6;
BUTTON_FACE_Y = 13.0;            // outer face of the button island
BUTTON_WALL = 1.4;
BUTTON_HOLE_D = 5.4;
BUTTON_HEAD_D = 5.0;
BUTTON_PROUD = 0.8;
BUTTON_FLANGE_D = 7.0;
BUTTON_FLANGE_T = 0.6;
SWITCH_W = 6.0;                  // 6 x 6 x 2.5 SMD tact switch, legs on the +/-X sides
SWITCH_T = 2.5;                  // MEASURE: total height including the actuator
SWITCH_LEGS = 1.2;
BACKING_T = 0.8;
SW_TOP_Y = BUTTON_FACE_Y - BUTTON_WALL - BUTTON_FLANGE_T;   // actuator tip
SW_BASE_Y = SW_TOP_Y - SWITCH_T;
BACKING_Y = SW_BASE_Y - BACKING_T;                          // must stay above STACK_MAX_Y

// ---------- Elastic channel, bone arm, access openings ----------
ELASTIC_XS = [-19.5, 12.5];
ELASTIC_W = 7.0;                 // for a 6 mm flat elastic
ELASTIC_GAP = 1.8;
ELASTIC_BRIDGE_T = 1.6;
ELASTIC_LEN = 12.0;

TRANSDUCER_SIZE = 14.0;          // MEASURE: the transducer's real size
TRANSDUCER_CLEAR = 0.2;          // per side
TRANSDUCER_INNER = TRANSDUCER_SIZE + 2 * TRANSDUCER_CLEAR;
TRANSDUCER_WALL = 2.2;
TRANSDUCER_OUTER = TRANSDUCER_INNER + 2 * TRANSDUCER_WALL;
TRANSDUCER_CENTER = [69.0, -22.0, -16.0];
TRANSDUCER_DEPTH = 7.4;

UPS_SWITCH = [-30.5, -5.0, 0];   // MEASURE: lever centre (front short edge of the HAT)
UPS_WINDOW = [5.0, 10.0];        // X x Z, through the left (head-side) wall
CHARGE_PORT = true;
CHARGE_X = STACK_FRONT_X + 61.0; // MEASURE: micro USB of the HAT, ~61 from the switch end (Waveshare photo)
CHARGE_Y = -5.0;                 // MEASURE
CHARGE_WINDOW = [11.0, 7.0];     // X x Y, through the bottom wall (fits a moulded plug)

// Outer shape: X, total Y width, total Z height, corner radius.
stations = [
    [-44.0, 28.6, 31.4, 5.4],
    [-41.4, 29.8, 33.2, 5.8],
    [-36.0, 30.2, 34.6, 6.0],
    [-31.0, 29.4, 36.4, 6.2],
    [-24.0, 25.2, 36.8, 6.4],
    [ -5.0, 24.6, 36.8, 6.5],
    [ 13.0, 24.2, 36.8, 6.3],
    [ 30.0, 23.8, 36.8, 6.2],
    [ 35.0, 23.2, 36.4, 6.0],
    [ 37.6, 22.0, 34.8, 5.6],
    [ 39.8, 19.0, 29.0, 5.0],
    [ 41.6, 13.0, 21.0, 4.2]
];

// ---------- Helpers (from v0.8) ----------
module rr2d(s = [10, 10], r = 2) { offset(r = r) square([max(.2, s[0] - 2 * r), max(.2, s[1] - 2 * r)], center = true); }
module rounded_box3d(size = [10, 10, 10], r = 1.5) {
    minkowski() {
        cube([max(.2, size[0] - 2 * r), max(.2, size[1] - 2 * r), max(.2, size[2] - 2 * r)], center = true);
        sphere(r = r, $fn = 24);
    }
}
module rounded_prism_x(L, W, H, r = 2) { translate([-L / 2, 0, 0]) rotate([0, 90, 0]) linear_extrude(height = L) rr2d([H, W], r); }
module slice_x(x, w, h, r, t = .30) { translate([x, 0, 0]) rotate([0, 90, 0]) linear_extrude(height = t, center = true) rr2d([h, w], r); }
module capsule(p1, p2, r = 2) { hull() { translate(p1) sphere(r = r, $fn = 28); translate(p2) sphere(r = r, $fn = 28); } }
module loft(st) { for (i = [0 : len(st) - 2]) hull() { slice_x(st[i][0], st[i][1], st[i][2], st[i][3]); slice_x(st[i + 1][0], st[i + 1][1], st[i + 1][2], st[i + 1][3]); } }
module box(p0, p1) { translate(p0) cube(p1 - p0); }
module hex_y(af, h) { rotate([-90, 0, 0]) rotate([0, 0, 30]) cylinder(h = h, r = af / sqrt(3), $fn = 6); }
module half_space(side) { translate([0, side * 100, 0]) cube([200, 200, 200], center = true); }
// mirror a Z-up feature to the bottom wall as well
module both_walls() { children(); mirror([0, 0, 1]) children(); }

// ---------- Shell ----------
module button_island() {
    hull() for (x = [BUTTON_XS[0] - 5.5, BUTTON_XS[1] + 5.5], z = [BUTTON_Z - 5.5, BUTTON_Z + 5.5])
        translate([x, BUTTON_FACE_Y - 3.0, z]) sphere(r = 3.0, $fn = 32);
}
module outer_shell() { union() { loft(stations); button_island(); } }

module chamber() {
    // camera chamber: wide part around the PCB, narrower neck behind it to the board stack
    translate([(CHAMBER_FRONT_X + CHAMBER_NECK_X) / 2, 0, 0])
        rounded_prism_x(CHAMBER_NECK_X - CHAMBER_FRONT_X, 2 * CHAMBER_HY, 2 * CHAMBER_HZ, CHAMBER_R);
    translate([(CHAMBER_NECK_X - 0.5 + STACK_FRONT_X + 1) / 2, 0, 0])
        rounded_prism_x(STACK_FRONT_X + 1 - CHAMBER_NECK_X + 0.5, 2 * CHAMBER_NECK_HY, 2 * CHAMBER_HZ, 2.5);
}
module cavity() {
    translate([PI_CX, 0, 0]) rounded_prism_x(CAV_L, CAV_W, CAV_H, 2.5);
    chamber();
}

module lens_opening() {
    translate([NOSE_X - 2, 0, LENS_Z]) rotate([0, 90, 0]) cylinder(h = CHAMBER_FRONT_X - NOSE_X + 2.1, d = LENS_HOLE_D);
    // outer chamfer so the 66 x 52 degree field of view is never clipped
    translate([NOSE_X - 0.01, 0, LENS_Z]) rotate([0, 90, 0]) cylinder(h = 1.3, d1 = LENS_HOLE_D + 2.6, d2 = LENS_HOLE_D);
}

module access_cuts() {
    // microSD at the rear short edge (v0.8)
    translate([38.0, 0, 4.0]) rounded_box3d([8.0, 8.0, 15.5], 1.0);
    // UPS HAT switch: window through the head-side wall, in front of the HAT
    translate([UPS_SWITCH[0], -15, UPS_SWITCH[2]]) rounded_box3d([UPS_WINDOW[0], 12, UPS_WINDOW[1]], 1.2);
    // charging micro USB through the bottom wall
    if (CHARGE_PORT) translate([CHARGE_X, CHARGE_Y, -CAV_HZ - 2]) rounded_box3d([CHARGE_WINDOW[0], CHARGE_WINDOW[1], 6], 1.5);
}

// ---------- Camera ribs: capture the PCB edges, both halves get their share ----------
module camera_ribs() {
    front = [CAM_FRONT_X - RIB_GAP - RIB_T, CAM_FRONT_X - RIB_GAP];
    back = [CAM_BACK_X + RIB_GAP, CAM_BACK_X + RIB_GAP + RIB_T];
    ey = AI_CAM_W / 2 - RIB_OVERLAP;
    ez = AI_CAM_H / 2 - RIB_OVERLAP;
    intersection() {
        chamber();
        union() {
            for (r = [front, back]) {
                // sides (Y), clear of the mounting holes
                for (s = [-1, 1]) box([r[0], s > 0 ? ey : -CHAMBER_HY - 1, -ez], [r[1], s > 0 ? CHAMBER_HY + 1 : -ey, ez]);
                // top
                box([r[0], -CHAMBER_HY - 1, ez], [r[1], CHAMBER_HY + 1, CHAMBER_HZ + 1]);
            }
            // bottom: front rib full width; back rib leaves the FPC connector and flex free
            box([front[0], -CHAMBER_HY - 1, -CHAMBER_HZ - 1], [front[1], CHAMBER_HY + 1, -ez]);
            for (s = [-1, 1]) box([back[0], s > 0 ? AI_CAM_CONN_W / 2 + 0.6 : -CHAMBER_HY - 1, -CHAMBER_HZ - 1],
                                  [back[1], s > 0 ? CHAMBER_HY + 1 : -AI_CAM_CONN_W / 2 - 0.6, -ez]);
        }
    }
}

// ---------- Melt pads for the existing metal standoffs ----------
module melt_pad_solid(x, z) {
    translate([x, -11.0, z]) rotate([-90, 0, 0]) cylinder(h = PAD_TOP_Y + 11.0, d = PAD_D);
    // reflowable collar: the iron touches this ring and the standoff, never a board
    translate([x, PAD_TOP_Y - 0.01, z]) rotate([-90, 0, 0])
        difference() { cylinder(h = COLLAR_H, d = SOCKET_AF / cos(30) + 2 * COLLAR_W); cylinder(h = 3, d = SOCKET_AF / cos(30) + 0.1, center = true); }
}
module melt_pad_socket(x, z) { translate([x, STACK_MIN_Y, z]) hex_y(SOCKET_AF, SOCKET_DEPTH + 2); }
module pad_positions() { for (dx = [-PI_HOLE_X, PI_HOLE_X], z = [-PI_HOLE_Z, PI_HOLE_Z]) translate([PI_CX + dx, 0, z]) children(); }

// ---------- Elastic channel (head-side face) ----------
module elastic_bridges() {
    for (x = ELASTIC_XS) {
        wall = -11.6;
        difference() {
            hull() {
                translate([x, wall + 0.5, 0]) cube([ELASTIC_W + 4.0, 1, ELASTIC_LEN + 4], center = true);
                translate([x, wall - ELASTIC_GAP - ELASTIC_BRIDGE_T / 2, 0]) rounded_box3d([ELASTIC_W + 2.4, ELASTIC_BRIDGE_T, ELASTIC_LEN], 0.7);
            }
            translate([x, wall - ELASTIC_GAP / 2, 0]) cube([ELASTIC_W, ELASTIC_GAP, ELASTIC_LEN + 10], center = true);
        }
    }
}

// ---------- Bone arm socket (v0.8) ----------
module bone_socket_boss() { translate([29, -13.2, -.5]) rounded_box3d([13.2, 5.4, 15.4], 2); }
module bone_socket_cut() { translate([29, -15, -.5]) rounded_box3d([9.2, 6.3, 11.3], 1.1); }
module bone_cable_port() { translate([29, -8, -.5]) rotate([90, 0, 0]) cylinder(h = 12.5, d = 3.4); }

// ---------- Snap tabs, lip, pins ----------
module lip_band(x0, x1, hz, len) { box([x0, -len, hz], [x1, 0.01, hz + LIP_T]); }
module bump(x0, x1, hz) {
    // lead-in ramp toward the tip (-Y, ~19 deg), 45 deg retention face toward the root
    yb = -TAB_LEN + 0.1;
    translate([x0, 0, hz + LIP_T - 0.01]) rotate([90, 0, 90]) linear_extrude(height = x1 - x0)
        polygon([[yb, 0], [yb + 1.0, BUMP_H], [yb + 1.35, BUMP_H], [yb + 1.7, 0]]);
}
module tabs_right() {
    for (t = TABS) both_walls() {
        x0 = t[0] - t[1] / 2; x1 = t[0] + t[1] / 2;
        lip_band(x0, x1, t[2], TAB_LEN);
        bump(x0, x1, t[2]);
    }
    for (s = LIP_SEGMENTS) both_walls() lip_band(s[0], s[1], s[2], LIP_LEN);
    for (p = PINS) translate([p[0], 0.01, p[1]]) rotate([90, 0, 0]) {
        cylinder(h = PIN_LEN - 0.5, d = PIN_D);
        translate([0, 0, PIN_LEN - 0.51]) cylinder(h = 0.5, d1 = PIN_D, d2 = PIN_D - 0.8);
    }
}
module tab_reliefs_right() {
    // free the tab from the right-half wall so it flexes over TAB_ROOT + TAB_LEN, not just TAB_LEN
    for (t = TABS) both_walls() {
        x0 = t[0] - t[1] / 2; x1 = t[0] + t[1] / 2;
        box([x0 - TAB_SLOT, -TAB_LEN - 1, t[2] - 0.01], [x0, TAB_ROOT, t[2] + LIP_T + TAB_RELIEF]);
        box([x1, -TAB_LEN - 1, t[2] - 0.01], [x1 + TAB_SLOT, TAB_ROOT, t[2] + LIP_T + TAB_RELIEF]);
        box([x0, -0.01, t[2] + LIP_T], [x1, TAB_ROOT, t[2] + LIP_T + TAB_RELIEF]);
    }
}
module recesses_left() {
    for (t = TABS) both_walls() {
        x0 = t[0] - t[1] / 2 - 0.3; x1 = t[0] + t[1] / 2 + 0.3;
        box([x0, -TAB_LEN - 0.3, t[2] - 0.01], [x1, 0.01, t[2] + LIP_T + LIP_CLEAR]);
        // groove for the bump
        yb = -TAB_LEN + 0.1;
        box([x0, yb + 0.45, t[2] + LIP_T], [x1, yb + 1.8, t[2] + LIP_T + LIP_CLEAR + BUMP_H + 0.1]);
    }
    for (s = LIP_SEGMENTS) both_walls() box([s[0] - 0.3, -LIP_LEN - 0.3, s[2] - 0.01], [s[1] + 0.3, 0.01, s[2] + LIP_T + LIP_CLEAR]);
    for (p = PINS) translate([p[0], 0.01, p[1]]) rotate([90, 0, 0]) cylinder(h = PIN_LEN + 0.4, d = PIN_HOLE_D);
    // pry notch at the rear seam to open the case with a fingernail or a coin
    translate([40.0, 0, -6]) rounded_box3d([6, 1.6, 5], 0.4);
}

// ---------- Button drawers (right half) ----------
module switch_drawer_solid(x) {
    w = SWITCH_W + 2 * SWITCH_LEGS + 1.6;
    box([x - w / 2, BACKING_Y, BUTTON_Z - SWITCH_W / 2 - 1.2], [x + w / 2, 10.5, BUTTON_Z + SWITCH_W / 2 + 1.0]);
}
module switch_drawer_cut(x) {
    w = SWITCH_W + 2 * SWITCH_LEGS + 0.3;
    // switch bay, open toward -Z: the switch slides up into it and the wires leave downward
    box([x - w / 2, SW_BASE_Y, BUTTON_Z - SWITCH_W / 2 - 3], [x + w / 2, SW_TOP_Y + 0.01, BUTTON_Z + SWITCH_W / 2 + 0.15]);
    // retention sill: the bay opening is 0.3 narrower than the switch, so it clicks past it
    // (implemented by not cutting a 0.3 band at the bottom of the backing side)
    // flange room behind the wall
    translate([x, SW_TOP_Y - 0.01, BUTTON_Z]) rotate([-90, 0, 0]) cylinder(h = BUTTON_FLANGE_T + 0.02, d = BUTTON_FLANGE_D + 0.5);
    translate([x, SW_TOP_Y, BUTTON_Z]) rotate([-90, 0, 0]) cylinder(h = 10, d = BUTTON_HOLE_D);
}
module switch_sill(x) {
    w = SWITCH_W + 2 * SWITCH_LEGS + 0.3;
    box([x - w / 2, SW_BASE_Y, BUTTON_Z - SWITCH_W / 2 - 0.45], [x + w / 2, SW_BASE_Y + 0.45, BUTTON_Z - SWITCH_W / 2 - 0.15]);
}

// ---------- Halves ----------
module left_body() {
    difference() {
        union() {
            intersection() {
                difference() { outer_shell(); cavity(); }
                half_space(-1);
            }
            intersection() { camera_ribs(); half_space(-1); }
            pad_positions() melt_pad_solid(0, 0);
            elastic_bridges();
            bone_socket_boss();
        }
        pad_positions() melt_pad_socket(0, 0);
        lens_opening();
        access_cuts();
        recesses_left();
        bone_socket_cut();
        bone_cable_port();
    }
}

module right_body() {
    difference() {
        union() {
            intersection() {
                difference() { outer_shell(); cavity(); }
                half_space(1);
            }
            intersection() { camera_ribs(); half_space(1); }
            for (x = BUTTON_XS) switch_drawer_solid(x);
            tabs_right();
        }
        lens_opening();
        access_cuts();
        tab_reliefs_right();
        for (x = BUTTON_XS) switch_drawer_cut(x);
    }
    for (x = BUTTON_XS) switch_sill(x);
}

// ---------- Button cap (print x2) ----------
// model frame: axis along +Y, flange face at SW_TOP_Y. The command button gets a ring, volume a bar.
module button_cap(kind = "command") {
    head_l = BUTTON_WALL + BUTTON_PROUD;
    difference() {
        union() {
            rotate([-90, 0, 0]) cylinder(h = BUTTON_FLANGE_T, d = BUTTON_FLANGE_D);
            translate([0, BUTTON_FLANGE_T - 0.01, 0]) rotate([-90, 0, 0]) cylinder(h = head_l, d = BUTTON_HEAD_D);
        }
        // tactile marks, readable without looking
        if (kind == "command") translate([0, BUTTON_FLANGE_T + head_l - 0.5, 0]) rotate([-90, 0, 0])
            difference() { cylinder(h = 1, d = 3.6); cylinder(h = 3, d = 2.0, center = true); }
        else translate([0, BUTTON_FLANGE_T + head_l - 0.5, 0]) cube([3.6, 1, 0.9], center = true);
    }
}
module button_caps_placed() {
    for (i = [0 : len(BUTTON_XS) - 1]) translate([BUTTON_XS[i], SW_TOP_Y, BUTTON_Z]) button_cap(i == 0 ? "command" : "volume");
}

// ---------- Bone arm (v0.8 geometry, 14 mm transducer pocket) ----------
arm_pts = [[29, -18, -.5], [36.5, -18.2, -.8], [44, -19, -2.5], [52, -20.1, -6.1], [59, -21.2, -10.8], [64, -22, -14.9]];
module bone_outer() { for (i = [0 : len(arm_pts) - 2]) capsule(arm_pts[i], arm_pts[i + 1], 2.7); }
module bone_tunnel() {
    p0 = [29, -12.8, -.5]; pN = [66.2, -22, -15.4];
    capsule(p0, arm_pts[0], 1.3);
    for (i = [0 : len(arm_pts) - 2]) capsule(arm_pts[i], arm_pts[i + 1], 1.3);
    capsule(arm_pts[len(arm_pts) - 1], pN, 1.3);
}
module bone_plug() {
    translate([29, -16.2, -.5]) rounded_box3d([8.7, 4.9, 10.8], 1);
    translate([29, -17, 5]) sphere(r = .55);
    translate([29, -17, -6]) sphere(r = .55);
}
module transducer_cradle() { translate(TRANSDUCER_CENTER) rounded_box3d([TRANSDUCER_OUTER, 8.8, TRANSDUCER_OUTER], 2.3); }
module transducer_pocket() {
    translate([TRANSDUCER_CENTER[0], TRANSDUCER_CENTER[1] - 2.2, TRANSDUCER_CENTER[2]]) cube([TRANSDUCER_INNER, TRANSDUCER_DEPTH, TRANSDUCER_INNER], center = true);
}
module bone_arm() {
    difference() {
        union() {
            bone_plug();
            // the arm stays 0.2 off the socket boss (v0.8 had it 0.6 inside the boss)
            difference() { union() { bone_outer(); transducer_cradle(); } translate([29, -13.2, -.5]) rounded_box3d([13.6, 5.8, 15.8], 2.2); }
        }
        bone_tunnel();
        transducer_pocket();
        translate([29, -13.6, -.5]) rotate([90, 0, 0]) cylinder(h = 3.8, d = 2.8, center = true);
        translate([64.6, -22, -15.4]) rotate([0, 90, 0]) cylinder(h = 7.4, d = 2.8);
    }
}

// ---------- Hardware mock-ups (for the assembly view and the interference checks) ----------
module hw_stack() {
    box([STACK_FRONT_X, STACK_BOARD_Y, -PI_W / 2], [STACK_REAR_X, STACK_MAX_Y, PI_W / 2]);
}
module hw_standoffs() { pad_positions() translate([0, STACK_MIN_Y, 0]) hex_y(STANDOFF_AF, STANDOFF_BELOW); }
module hw_ups_switch() { translate(UPS_SWITCH) cube([2.0, 2.0, 3.0], center = true); }
module hw_camera() {
    box([CAM_FRONT_X, -AI_CAM_W / 2, -AI_CAM_H / 2], [CAM_BACK_X, AI_CAM_W / 2, AI_CAM_H / 2]);
    bt = AI_CAM_H / 2 - AI_CAM_BLOCK_TOP;
    box([CAM_FRONT_X - AI_CAM_BLOCK_REACH, -AI_CAM_BLOCK_W / 2, bt - AI_CAM_BLOCK_H], [CAM_FRONT_X, AI_CAM_BLOCK_W / 2, bt]);
    translate([CAM_FRONT_X, 0, LENS_Z]) rotate([0, -90, 0]) cylinder(h = AI_CAM_RING_REACH, d = AI_CAM_RING_D);
    translate([CAM_FRONT_X, 0, LENS_Z]) rotate([0, -90, 0]) cylinder(h = AI_CAM_BARREL_REACH, d = AI_CAM_BARREL_D);
    box([CAM_BACK_X, -AI_CAM_CONN_W / 2, -AI_CAM_H / 2], [CAM_BACK_X + AI_CAM_CONN_REACH, AI_CAM_CONN_W / 2, -AI_CAM_H / 2 + AI_CAM_CONN_H]);
}
module hw_switches() {
    for (x = BUTTON_XS) box([x - SWITCH_W / 2 - SWITCH_LEGS, SW_BASE_Y, BUTTON_Z - SWITCH_W / 2], [x + SWITCH_W / 2 + SWITCH_LEGS, SW_TOP_Y, BUTTON_Z + SWITCH_W / 2]);
}
module hw_transducer() {
    translate([TRANSDUCER_CENTER[0], TRANSDUCER_CENTER[1] - 2.2, TRANSDUCER_CENTER[2]]) cube([TRANSDUCER_SIZE, 6, TRANSDUCER_SIZE], center = true);
}
module hardware() {
    color([.1, .55, .2]) hw_stack();
    color("goldenrod") hw_standoffs();
    color("red") hw_ups_switch();
    color([.15, .3, .9]) hw_camera();
    color("white") hw_switches();
    color("orange") hw_transducer();
}

module assembly() {
    color("#2c2c2c") translate([0, -EXPLODE, 0]) left_body();
    color("#4a4a4a", 0.55) translate([0, EXPLODE, 0]) right_body();
    color("#d9d9d9") translate([0, EXPLODE, 0]) button_caps_placed();
    color("#1b1b1b") translate([0, -EXPLODE, 0]) bone_arm();
    if (SHOW_HW) hardware();
}

// ---------- Print orientation: each half lies on its outer face ----------
// The outer faces are lofted, not flat: the widest point is the camera nose (Y = +/-15.1), so the
// halves touch the bed there and need tree supports under the rest (see README, Impresion).
module print_left() { translate([0, 0, 15.9]) rotate([90, 0, 0]) left_body(); }
module print_right() { translate([0, 0, 15.1]) rotate([-90, 0, 0]) right_body(); }
module print_button(kind) { rotate([90, 0, 0]) button_cap(kind); }
module print_bone() { translate([0, 0, 22.0 + TRANSDUCER_OUTER / 2 - 45.16]) rotate([-90, 0, 0]) bone_arm(); }

// ---------- Interference checks: every one of these must render EMPTY ----------
module check(name) {
    if (name == "halves") intersection() { left_body(); right_body(); }
    else if (name == "left_hw") intersection() { left_body(); union() { hw_stack(); hw_camera(); hw_ups_switch(); hw_switches(); } }
    else if (name == "right_hw") intersection() { right_body(); union() { hw_stack(); hw_camera(); hw_ups_switch(); hw_switches(); hw_standoffs(); } }
    else if (name == "caps") intersection() { button_caps_placed(); union() { left_body(); right_body(); hw_switches(); hw_stack(); } }
    else if (name == "bone") intersection() { bone_arm(); union() { left_body(); hw_transducer(); } }
    else if (name == "drawers_stack") intersection() { for (x = BUTTON_XS) switch_drawer_solid(x); hw_stack(); }
}

if (PART == "left") left_body();
else if (PART == "right") right_body();
else if (PART == "bone") bone_arm();
else if (PART == "button_command") button_cap("command");
else if (PART == "button_volume") button_cap("volume");
else if (PART == "print_left") print_left();
else if (PART == "print_right") print_right();
else if (PART == "print_bone") print_bone();
else if (PART == "print_buttons") { translate([-5, 0, 0]) print_button("command"); translate([5, 0, 0]) print_button("volume"); }
else if (PART == "hardware") hardware();
else if (len(PART) > 6 && PART[0] == "c" && PART[1] == "h" && PART[5] == "_") check(chr([for (i = [6 : len(PART) - 1]) ord(PART[i])]));
else assembly();
