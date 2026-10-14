// VIA Clara v0.9 — two-half snap-fit case for Raspberry Pi Zero 2 W + Waveshare UPS HAT (C) with its
// 803040 battery + Raspberry Pi AI Camera (IMX500) + bone-conduction transducer.
//
// Changes from v0.8 (see README.md for the reasoning):
//   - no external screws: the halves close with internal snap tabs + an alignment lip + two pins;
//   - no separate camera cap: the camera chamber is split between both halves, the PCB is captured
//     by edge ribs (no pegs through its holes) and there is a single front lens opening;
//   - the metal standoffs / screw heads under the UPS HAT seat in chassis pads with a reflowable
//     collar (no plastic pins through the Raspberry Pi holes, no heat on the boards);
//   - real stack: HAT, battery and pogo pins under the Pi, soldered male header on top (~23 mm);
//   - openings at the real connector positions: microSD and charging micro USB at the rear, the UPS
//     switch (front end of the HAT) through a slider on the head-side face;
//   - one mode button with its switch drawer; bone transducer pocket at 14 mm + fit clearance.
//
// Units: mm. Frame: X along the temple (front = -X, camera end), Y across (left half / head side
// is Y < 0, right half / outer side is Y > 0, parting plane Y = 0), Z up.
// Sources: Raspberry Pi Zero 2 W mechanical drawing, AI Camera product brief (Sept. 2024),
// Waveshare UPS HAT (C) wiki photos (positions scaled from the 65 x 30 board outline).
// Values tagged MEASURE are not in any drawing and must be checked with a caliper.

$fn = $preview ? 40 : 64;
PART = is_undef(PART) ? "assembly" : PART;
SHOW_HW = is_undef(SHOW_HW) ? true : SHOW_HW;
EXPLODE = is_undef(EXPLODE) ? 0 : EXPLODE;

// ---------- Cavity and walls ----------
WALL = 2.2;
CAV_HY = 13.0;                   // cavity half width (Y)
CAV_HZ = 15.9;                   // cavity half height (Z): 30 mm boards + 0.9
CAV_L = 67.2;
LEFT_FACE = -(CAV_HY + WALL);    // -15.2, head side
RIGHT_FACE = CAV_HY + WALL;      //  15.2, outer side

// ---------- Board stack (X: front -> rear) ----------
PI_L = 65;
PI_W = 30;
PI_CX = 3.0;
STACK_FRONT_X = PI_CX - PI_L / 2;    // -29.5: Pi CSI connector + HAT switch end
STACK_REAR_X = PI_CX + PI_L / 2;     //  35.5: Pi microSD + HAT micro USB end
PI_HOLE_X = 29.0;                    // 58 x 23 hole pattern, shared by the Pi and the HAT
PI_HOLE_Z = 11.5;

// Melt pads under the HAT: hex socket for the screw head / standoff + reflowable collar
PAD_D = 8.0;
PAD_H = 2.6;
SOCKET_DEPTH = 2.2;
STANDOFF_AF = 5.0;               // MEASURE: across flats of the metal standoff (a Ø4.5 screw head also fits)
SOCKET_AF = STANDOFF_AF - 0.1;
COLLAR_H = 0.8;
COLLAR_W = 0.8;
PAD_TOP_Y = -CAV_HY + PAD_H;                 // -10.4

// Stack heights along Y (head side -> outer side)
HAT_PCB = 1.6;
HAT_UNDER = 0.9;                 // tallest part under the HAT (Waveshare STEP model)
BOARD_GAP = 10.5;                // MEASURE: HAT top face to Pi bottom face (battery 8 + header tails)
PI_PCB = 1.4;
PI_PARTS = 3.2;                  // connectors on the Pi top side
HEADER_H = 8.5;                  // soldered male header above the Pi PCB (2.5 plastic + 6 pin)
HAT_BOTTOM_Y = PAD_TOP_Y + COLLAR_H;         // -9.6
HAT_TOP_Y = HAT_BOTTOM_Y + HAT_PCB;          // -8.0
PI_BOTTOM_Y = HAT_TOP_Y + BOARD_GAP;         //  2.5
PI_TOP_Y = PI_BOTTOM_Y + PI_PCB;             //  3.9
HEADER_TOP_Y = PI_TOP_Y + HEADER_H;          // 12.4 -> 0.6 to the right wall
HEADER_Z = [9.0, 14.0];          // header band: top long edge (pin 1 at the microSD end)

// UPS HAT (C) parts in the HAT frame, scaled from the Waveshare photo: x from the switch end;
// case z = (distance from the edge opposite the pogo pins) - 15.
BAT = [40, 30, 8];               // 803040
BAT_X0 = 5.9;
SW_BODY_X = [-0.3, 5.7];         // slide switch housing, overhangs the board edge
SW_BODY_Z = [-6.65, 6.65];
SW_BODY_H = 7.0;                 // MEASURE: housing height above the HAT
LEVER_TIP = 4.4;                 // lever reaches 4.4 past the board edge
LEVER_W = 2.9;                   // along Z (the travel axis)
LEVER_Y = [2.0, 5.0];            // MEASURE: lever above the HAT top face
LEVER_TRAVEL = 3.3;              // MEASURE: ON at -Z, OFF at +Z
USB_X = [59.6, 65.3];            // charging micro USB, faces the rear
USB_Z = [-6.8, 1.0];
USB_H = 3.0;
JST_X = [51.5, 58.0];
JST_Z = [-15.2, -10.1];
JST_H = 6.0;

// ---------- Raspberry Pi AI Camera (product brief, Sept. 2024, page 4) ----------
AI_CAM_W = 25.0;                 // Y
AI_CAM_H = 23.862;               // Z, FPC connector on the bottom edge
AI_CAM_PCB_T = 1.12;
AI_CAM_LENS_FROM_TOP = 14.4;     // lens centred across the width, level with the lower hole row
AI_CAM_BARREL_D = 5.75;
AI_CAM_BARREL_REACH = 6.98;
AI_CAM_TIER = 10.8;              // second optical tier, square
AI_CAM_TIER_REACH = 3.875;
AI_CAM_BLOCK_W = 12.8;
AI_CAM_BLOCK_Z = [2.4, 19.5];    // optical block, measured from the bottom edge
AI_CAM_BLOCK_REACH = 2.75;
AI_CAM_CONN_W = 19.61;
AI_CAM_CONN_H = 5.71;
AI_CAM_CONN_REACH = 3.8;

NOSE_X = -44.0;
CAM_FRONT_X = NOSE_X + 0.1 + AI_CAM_BARREL_REACH;    // -36.92: barrel 0.1 inside the nose
CAM_BACK_X = CAM_FRONT_X + AI_CAM_PCB_T;             // -35.80
LENS_Z = AI_CAM_H / 2 - AI_CAM_LENS_FROM_TOP;        // -2.47 with the board centred on Z = 0
LENS_HOLE_D = AI_CAM_BARREL_D + 0.65;

CHAMBER_FRONT_X = CAM_FRONT_X - AI_CAM_TIER_REACH - 0.3;
CHAMBER_HY = AI_CAM_W / 2 + 0.9;                     // 13.4
CHAMBER_HZ = 14.6;
CHAMBER_R = 3.5;
RIB_T = 0.65;
RIB_GAP = 0.05;
RIB_OVERLAP = 0.8;

// ---------- Snap fit ----------
LIP_T = 1.2;
LIP_CLEAR = 0.2;
LIP_LEN = 2.5;
TAB_LEN = 5.0;
TAB_ROOT = 2.5;
TAB_RELIEF = 0.5;
TAB_SLOT = 0.8;
BUMP_H = 0.35;
TABS = [[-33.1, 3.8, CHAMBER_HZ], [-16.0, 9.0, CAV_HZ], [20.0, 9.0, CAV_HZ]];
LIP_SEGMENTS = [[-40.5, -35.6, CHAMBER_HZ], [-30.6, -21.3, CAV_HZ], [-10.7, 14.7, CAV_HZ], [25.3, 34.0, CAV_HZ]];
PIN_D = 2.4;
PIN_LEN = 2.6;
PIN_HOLE_D = 2.75;
PINS = [[38.6, -12.5], [38.6, 12.5]];

// ---------- Mode button (one) ----------
BUTTON_X = 2.0;
BUTTON_Z = 2.0;
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
SW_TOP_Y = RIGHT_FACE - BUTTON_WALL - BUTTON_FLANGE_T;     // 13.2: actuator tip
SW_BASE_Y = SW_TOP_Y - SWITCH_T;
BACKING_Y = SW_BASE_Y - BACKING_T;                          //  9.9, well above the Pi parts (7.1)

// ---------- Rear openings ----------
SD_Z = [-8.0, 8.5];              // MEASURE: generous, the card is 11 wide
SD_Y = [PI_TOP_Y - 1.5, PI_TOP_Y + 4.5];
SD_CARD_OUT = 2.5;               // the card sticks out of the Pi edge
CHARGE_PLUG = [11.5, 7.5];       // moulded micro USB plug: Z x Y

// ---------- Power slider (HAT switch, head-side face) ----------
SLIDER_X = [-34.6, -30.8];       // knob / window, in front of the HAT edge, behind the camera
SLIDER_KNOB_Z = 5.0;
SLIDER_PLATE_T = 1.0;
SLIDER_PRONG_T = 1.2;
SLIDER_CLEAR = 0.35;

// ---------- Elastic channel, bone arm ----------
ELASTIC_XS = [-19.5, 12.5];
ELASTIC_W = 7.0;
ELASTIC_GAP = 1.8;
ELASTIC_BRIDGE_T = 1.6;
ELASTIC_LEN = 12.0;

ARM_DY = LEFT_FACE + 12.1;       // the head-side face moved 3.1 toward the head since v0.8
TRANSDUCER_SIZE = 14.0;          // MEASURE: the transducer's real size
TRANSDUCER_CLEAR = 0.2;
TRANSDUCER_INNER = TRANSDUCER_SIZE + 2 * TRANSDUCER_CLEAR;
TRANSDUCER_WALL = 2.2;
TRANSDUCER_OUTER = TRANSDUCER_INNER + 2 * TRANSDUCER_WALL;
TRANSDUCER_CENTER = [69.0, -22.0 + ARM_DY, -16.0];
TRANSDUCER_DEPTH = 7.4;

// Outer shape: X, total Y width, total Z height, corner radius. Flat sides between -41 and 30.
stations = [
    [-44.0, 29.0, 31.4, 5.4],
    [-41.0, 30.4, 33.2, 5.8],
    [-36.0, 30.4, 34.6, 6.0],
    [-31.0, 30.4, 36.4, 6.2],
    [-24.0, 30.4, 36.8, 6.4],
    [ 30.0, 30.4, 36.8, 6.4],
    [ 35.0, 30.2, 36.4, 6.2],
    [ 37.6, 29.6, 34.8, 6.0],
    [ 39.8, 27.6, 30.6, 5.6],
    [ 41.6, 23.6, 25.0, 5.0]
];

// ---------- Helpers ----------
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
module both_walls() { children(); mirror([0, 0, 1]) children(); }
function hat_x(x) = STACK_FRONT_X + x;

// ---------- Shell ----------
module outer_shell() { loft(stations); }

module chamber() {
    translate([(CHAMBER_FRONT_X + STACK_FRONT_X + 1) / 2, 0, 0])
        rounded_prism_x(STACK_FRONT_X + 1 - CHAMBER_FRONT_X, 2 * CHAMBER_HY, 2 * CHAMBER_HZ, CHAMBER_R);
}
module cavity() {
    translate([PI_CX, 0, 0]) rounded_prism_x(CAV_L, 2 * CAV_HY, 2 * CAV_HZ, 2.5);
    chamber();
}

module lens_opening() {
    translate([NOSE_X - 2, 0, LENS_Z]) rotate([0, 90, 0]) cylinder(h = CHAMBER_FRONT_X - NOSE_X + 2.1, d = LENS_HOLE_D);
    translate([NOSE_X - 0.01, 0, LENS_Z]) rotate([0, 90, 0]) cylinder(h = 1.3, d1 = LENS_HOLE_D + 2.6, d2 = LENS_HOLE_D);
}

module rear_openings() {
    // microSD: slot through the rear wall, flared outward so a fingernail reaches the card
    hull() {
        box([STACK_REAR_X - 0.5, SD_Y[0], SD_Z[0]], [STACK_REAR_X + 3.5, SD_Y[1], SD_Z[1]]);
        box([45, SD_Y[0] - 1.5, SD_Z[0] - 1.5], [45.1, SD_Y[1] + 1.5, SD_Z[1] + 1.5]);
    }
    // charging micro USB of the HAT: straight channel for the moulded plug
    cy = HAT_TOP_Y + USB_H / 2;
    cz = (USB_Z[0] + USB_Z[1]) / 2;
    translate([STACK_REAR_X + 5, cy, cz]) rounded_box3d([12, CHARGE_PLUG[1], CHARGE_PLUG[0]], 1.5);
}

// ---------- Camera ribs ----------
module camera_ribs() {
    front = [CAM_FRONT_X - RIB_GAP - RIB_T, CAM_FRONT_X - RIB_GAP];
    back = [CAM_BACK_X + RIB_GAP, CAM_BACK_X + RIB_GAP + RIB_T];
    ey = AI_CAM_W / 2 - RIB_OVERLAP;
    ez = AI_CAM_H / 2 - RIB_OVERLAP;
    intersection() {
        chamber();
        union() {
            for (r = [front, back]) {
                for (s = [-1, 1]) box([r[0], s > 0 ? ey : -CHAMBER_HY - 1, -ez], [r[1], s > 0 ? CHAMBER_HY + 1 : -ey, ez]);
                box([r[0], -CHAMBER_HY - 1, ez], [r[1], CHAMBER_HY + 1, CHAMBER_HZ + 1]);
            }
            box([front[0], -CHAMBER_HY - 1, -CHAMBER_HZ - 1], [front[1], CHAMBER_HY + 1, -ez]);
            for (s = [-1, 1]) box([back[0], s > 0 ? AI_CAM_CONN_W / 2 + 0.6 : -CHAMBER_HY - 1, -CHAMBER_HZ - 1],
                                  [back[1], s > 0 ? CHAMBER_HY + 1 : -AI_CAM_CONN_W / 2 - 0.6, -ez]);
        }
    }
}

// ---------- Melt pads ----------
module melt_pad_solid() {
    translate([0, -CAV_HY - 0.5, 0]) rotate([-90, 0, 0]) cylinder(h = PAD_H + 0.5, d = PAD_D);
    // reflowable collar: the iron touches this ring and the metal, never a board
    translate([0, PAD_TOP_Y - 0.01, 0]) rotate([-90, 0, 0])
        difference() { cylinder(h = COLLAR_H, d = SOCKET_AF / cos(30) + 2 * COLLAR_W); cylinder(h = 3, d = SOCKET_AF / cos(30) + 0.1, center = true); }
}
module melt_pad_socket() { translate([0, PAD_TOP_Y - SOCKET_DEPTH, 0]) hex_y(SOCKET_AF, SOCKET_DEPTH + 2); }
module pad_positions() { for (dx = [-PI_HOLE_X, PI_HOLE_X], z = [-PI_HOLE_Z, PI_HOLE_Z]) translate([PI_CX + dx, 0, z]) children(); }

// ---------- Power slider: a knob on the head-side face drives the HAT switch lever ----------
SLIDER_WIN_Z = SLIDER_KNOB_Z + LEVER_TRAVEL + 0.4;
module slider_window() {
    translate([(SLIDER_X[0] + SLIDER_X[1]) / 2, LEFT_FACE, 0]) cube([SLIDER_X[1] - SLIDER_X[0], 2 * WALL + 1, SLIDER_WIN_Z], center = true);
}
// modelled in the OFF position (lever at +Z); the knob sits LEVER_TRAVEL/2 above the window centre
module power_slider() {
    zc = LEVER_TRAVEL / 2;
    kx = SLIDER_X[1] - SLIDER_X[0] - 0.4;
    px = [SLIDER_X[0] - 0.4, SLIDER_X[1] + 0.6];   // stays behind the camera's rear rib
    ly0 = HAT_TOP_Y + LEVER_Y[0];
    ly1 = HAT_TOP_Y + LEVER_Y[1];
    gap = LEVER_W / 2 + SLIDER_CLEAR;
    lever_x = [hat_x(-LEVER_TIP) + 0.3, hat_x(SW_BODY_X[0]) - 0.3];
    union() {
        // knob through the window, 0.8 proud, with two grip ridges
        translate([(SLIDER_X[0] + SLIDER_X[1]) / 2, LEFT_FACE + WALL / 2 - 0.4, zc]) cube([kx, WALL + 0.8 + 0.01, SLIDER_KNOB_Z], center = true);
        for (dz = [-1.2, 1.2]) translate([(SLIDER_X[0] + SLIDER_X[1]) / 2, LEFT_FACE - 0.8, zc + dz]) rotate([0, 90, 0]) cylinder(h = kx, d = 0.8, center = true, $fn = 12);
        // plate inside the wall: covers the window in both positions
        box([px[0], -CAV_HY + 0.05, zc - SLIDER_WIN_Z / 2 - 1.2], [px[1], -CAV_HY + 0.05 + SLIDER_PLATE_T, zc + SLIDER_WIN_Z / 2 + 1.2]);
        // web and fork around the lever
        box([lever_x[0], -CAV_HY + 0.05, zc - gap - SLIDER_PRONG_T], [lever_x[1], ly0 - 0.4, zc + gap + SLIDER_PRONG_T]);
        for (s = [-1, 1]) box([lever_x[0], ly0 - 0.5, s > 0 ? zc + gap : zc - gap - SLIDER_PRONG_T],
                              [lever_x[1], ly1 + 0.6, s > 0 ? zc + gap + SLIDER_PRONG_T : zc - gap]);
    }
}

// ---------- Elastic channel (head-side face) ----------
module elastic_bridges() {
    wall = LEFT_FACE + 0.3;
    for (x = ELASTIC_XS) difference() {
        hull() {
            translate([x, wall + 0.5, 0]) cube([ELASTIC_W + 4.0, 1, ELASTIC_LEN + 4], center = true);
            translate([x, wall - ELASTIC_GAP - ELASTIC_BRIDGE_T / 2, 0]) rounded_box3d([ELASTIC_W + 2.4, ELASTIC_BRIDGE_T, ELASTIC_LEN], 0.7);
        }
        translate([x, wall - ELASTIC_GAP / 2, 0]) cube([ELASTIC_W, ELASTIC_GAP, ELASTIC_LEN + 10], center = true);
    }
}

// ---------- Bone arm socket ----------
module bone_socket_boss() { translate([29, -13.2 + ARM_DY, -.5]) rounded_box3d([13.2, 5.4, 15.4], 2); }
module bone_socket_cut() { translate([29, -15 + ARM_DY, -.5]) rounded_box3d([9.2, 6.3, 11.3], 1.1); }
module bone_cable_port() { translate([29, -CAV_HY + 2, -.5]) rotate([90, 0, 0]) cylinder(h = 12.6, d = 3.4); }

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
        yb = -TAB_LEN + 0.1;
        box([x0, yb + 0.45, t[2] + LIP_T], [x1, yb + 1.8, t[2] + LIP_T + LIP_CLEAR + BUMP_H + 0.1]);
    }
    for (s = LIP_SEGMENTS) both_walls() box([s[0] - 0.3, -LIP_LEN - 0.3, s[2] - 0.01], [s[1] + 0.3, 0.01, s[2] + LIP_T + LIP_CLEAR]);
    for (p = PINS) translate([p[0], 0.01, p[1]]) rotate([90, 0, 0]) cylinder(h = PIN_LEN + 0.4, d = PIN_HOLE_D);
    translate([40.0, 0, -12]) rounded_box3d([6, 1.6, 5], 0.4);   // pry notch at the rear seam
}

// ---------- Button drawer (right half) ----------
module switch_drawer_solid() {
    w = SWITCH_W + 2 * SWITCH_LEGS + 1.6;
    box([BUTTON_X - w / 2, BACKING_Y, BUTTON_Z - SWITCH_W / 2 - 1.2], [BUTTON_X + w / 2, CAV_HY + 0.5, BUTTON_Z + SWITCH_W / 2 + 1.0]);
}
module switch_drawer_cut() {
    w = SWITCH_W + 2 * SWITCH_LEGS + 0.3;
    // switch bay, open toward -Z: the switch slides up into it and the wires leave downward
    box([BUTTON_X - w / 2, SW_BASE_Y, BUTTON_Z - SWITCH_W / 2 - 3], [BUTTON_X + w / 2, SW_TOP_Y + 0.01, BUTTON_Z + SWITCH_W / 2 + 0.15]);
    translate([BUTTON_X, SW_TOP_Y - 0.01, BUTTON_Z]) rotate([-90, 0, 0]) cylinder(h = BUTTON_FLANGE_T + 0.02, d = BUTTON_FLANGE_D + 0.5);
    translate([BUTTON_X, SW_TOP_Y, BUTTON_Z]) rotate([-90, 0, 0]) cylinder(h = 10, d = BUTTON_HOLE_D);
    // finder ring around the button, to locate it by touch
    translate([BUTTON_X, RIGHT_FACE - 0.6, BUTTON_Z]) rotate([-90, 0, 0])
        difference() { cylinder(h = 2, d = 11.6); cylinder(h = 5, d = 9.0, center = true); }
}
module switch_sill() {
    // the bay opening is 0.3 narrower than the switch, so it clicks past this sill
    w = SWITCH_W + 2 * SWITCH_LEGS + 0.3;
    box([BUTTON_X - w / 2, SW_BASE_Y, BUTTON_Z - SWITCH_W / 2 - 0.45], [BUTTON_X + w / 2, SW_BASE_Y + 0.45, BUTTON_Z - SWITCH_W / 2 - 0.15]);
}

// ---------- Halves ----------
module left_body() {
    difference() {
        union() {
            intersection() { difference() { outer_shell(); cavity(); } half_space(-1); }
            intersection() { camera_ribs(); half_space(-1); }
            pad_positions() melt_pad_solid();
            elastic_bridges();
            bone_socket_boss();
        }
        pad_positions() melt_pad_socket();
        lens_opening();
        rear_openings();
        slider_window();
        recesses_left();
        bone_socket_cut();
        bone_cable_port();
    }
}

module right_body() {
    difference() {
        union() {
            intersection() { difference() { outer_shell(); cavity(); } half_space(1); }
            intersection() { camera_ribs(); half_space(1); }
            switch_drawer_solid();
            tabs_right();
        }
        lens_opening();
        rear_openings();
        tab_reliefs_right();
        switch_drawer_cut();
    }
    switch_sill();
}

// ---------- Button cap ----------
// model frame: axis along +Y, flange face at SW_TOP_Y; a raised ring marks it as the mode button
module button_cap() {
    head_l = BUTTON_WALL + BUTTON_PROUD;
    difference() {
        union() {
            rotate([-90, 0, 0]) cylinder(h = BUTTON_FLANGE_T, d = BUTTON_FLANGE_D);
            translate([0, BUTTON_FLANGE_T - 0.01, 0]) rotate([-90, 0, 0]) cylinder(h = head_l, d = BUTTON_HEAD_D);
        }
        translate([0, BUTTON_FLANGE_T + head_l - 0.5, 0]) rotate([-90, 0, 0])
            difference() { cylinder(h = 1, d = 3.6); cylinder(h = 3, d = 2.0, center = true); }
    }
}
module button_cap_placed() { translate([BUTTON_X, SW_TOP_Y, BUTTON_Z]) button_cap(); }

// ---------- Bone arm (v0.8 geometry, moved with the head-side face, 14 mm pocket) ----------
arm_pts = [for (p = [[29, -18, -.5], [36.5, -18.2, -.8], [44, -19, -2.5], [52, -20.1, -6.1], [59, -21.2, -10.8], [64, -22, -14.9]]) p + [0, ARM_DY, 0]];
module bone_outer() { for (i = [0 : len(arm_pts) - 2]) capsule(arm_pts[i], arm_pts[i + 1], 2.7); }
module bone_tunnel() {
    p0 = [29, -12.8 + ARM_DY, -.5]; pN = [66.2, -22 + ARM_DY, -15.4];
    capsule(p0, arm_pts[0], 1.3);
    for (i = [0 : len(arm_pts) - 2]) capsule(arm_pts[i], arm_pts[i + 1], 1.3);
    capsule(arm_pts[len(arm_pts) - 1], pN, 1.3);
}
module bone_plug() {
    translate([29, -16.2 + ARM_DY, -.5]) rounded_box3d([8.7, 4.9, 10.8], 1);
    translate([29, -17 + ARM_DY, 5]) sphere(r = .55);
    translate([29, -17 + ARM_DY, -6]) sphere(r = .55);
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
            difference() { union() { bone_outer(); transducer_cradle(); } translate([29, -13.2 + ARM_DY, -.5]) rounded_box3d([13.6, 5.8, 15.8], 2.2); }
        }
        bone_tunnel();
        transducer_pocket();
        translate([29, -13.6 + ARM_DY, -.5]) rotate([90, 0, 0]) cylinder(h = 3.8, d = 2.8, center = true);
        translate([64.6, -22 + ARM_DY, -15.4]) rotate([0, 90, 0]) cylinder(h = 7.4, d = 2.8);
    }
}

// ---------- Hardware mock-ups ----------
module hw_hat() {
    box([STACK_FRONT_X, HAT_BOTTOM_Y, -PI_W / 2], [STACK_REAR_X, HAT_TOP_Y, PI_W / 2]);
    box([STACK_FRONT_X + 8, HAT_BOTTOM_Y - HAT_UNDER, -PI_W / 2 + 6], [STACK_REAR_X - 8, HAT_BOTTOM_Y, PI_W / 2 - 6]);
    // battery, switch housing, micro USB, JST
    box([hat_x(BAT_X0), HAT_TOP_Y, -BAT[1] / 2], [hat_x(BAT_X0 + BAT[0]), HAT_TOP_Y + BAT[2], BAT[1] / 2]);
    box([hat_x(SW_BODY_X[0]), HAT_TOP_Y, SW_BODY_Z[0]], [hat_x(SW_BODY_X[1]), HAT_TOP_Y + SW_BODY_H, SW_BODY_Z[1]]);
    box([hat_x(USB_X[0]), HAT_TOP_Y, USB_Z[0]], [hat_x(USB_X[1]), HAT_TOP_Y + USB_H, USB_Z[1]]);
    box([hat_x(JST_X[0]), HAT_TOP_Y, JST_Z[0]], [hat_x(JST_X[1]), HAT_TOP_Y + JST_H, JST_Z[1]]);
}
module hw_lever() {
    box([hat_x(-LEVER_TIP), HAT_TOP_Y + LEVER_Y[0], LEVER_TRAVEL / 2 - LEVER_W / 2],
        [hat_x(SW_BODY_X[0]), HAT_TOP_Y + LEVER_Y[1], LEVER_TRAVEL / 2 + LEVER_W / 2]);
}
module hw_screw_heads() { pad_positions() translate([0, HAT_BOTTOM_Y - 1.8, 0]) rotate([-90, 0, 0]) cylinder(h = 1.8, d = 4.5); }
module hw_pi() {
    box([STACK_FRONT_X, PI_BOTTOM_Y, -PI_W / 2], [STACK_REAR_X, PI_TOP_Y, PI_W / 2]);
    box([STACK_FRONT_X, PI_TOP_Y, -PI_W / 2], [STACK_REAR_X, PI_TOP_Y + PI_PARTS, HEADER_Z[0]]);
    box([STACK_REAR_X - 57.9, PI_TOP_Y, HEADER_Z[0]], [STACK_REAR_X - 7.1, HEADER_TOP_Y, HEADER_Z[1]]);
    // microSD card sticking out of the rear edge
    box([STACK_REAR_X - 4, PI_TOP_Y + 0.2, -5.5], [STACK_REAR_X + SD_CARD_OUT, PI_TOP_Y + 1.2, 5.5]);
    // standoffs between the boards
    pad_positions() translate([0, HAT_TOP_Y, 0]) hex_y(STANDOFF_AF, BOARD_GAP);
}
module hw_camera() {
    box([CAM_FRONT_X, -AI_CAM_W / 2, -AI_CAM_H / 2], [CAM_BACK_X, AI_CAM_W / 2, AI_CAM_H / 2]);
    box([CAM_FRONT_X - AI_CAM_BLOCK_REACH, -AI_CAM_BLOCK_W / 2, -AI_CAM_H / 2 + AI_CAM_BLOCK_Z[0]], [CAM_FRONT_X, AI_CAM_BLOCK_W / 2, -AI_CAM_H / 2 + AI_CAM_BLOCK_Z[1]]);
    translate([CAM_FRONT_X - AI_CAM_TIER_REACH, -AI_CAM_TIER / 2, LENS_Z - AI_CAM_TIER / 2]) cube([AI_CAM_TIER_REACH, AI_CAM_TIER, AI_CAM_TIER]);
    translate([CAM_FRONT_X, 0, LENS_Z]) rotate([0, -90, 0]) cylinder(h = AI_CAM_BARREL_REACH, d = AI_CAM_BARREL_D);
    box([CAM_BACK_X, -AI_CAM_CONN_W / 2, -AI_CAM_H / 2], [CAM_BACK_X + AI_CAM_CONN_REACH, AI_CAM_CONN_W / 2, -AI_CAM_H / 2 + AI_CAM_CONN_H]);
}
module hw_switch() {
    box([BUTTON_X - SWITCH_W / 2 - SWITCH_LEGS, SW_BASE_Y, BUTTON_Z - SWITCH_W / 2], [BUTTON_X + SWITCH_W / 2 + SWITCH_LEGS, SW_TOP_Y, BUTTON_Z + SWITCH_W / 2]);
}
module hw_transducer() {
    translate([TRANSDUCER_CENTER[0], TRANSDUCER_CENTER[1] - 2.2, TRANSDUCER_CENTER[2]]) cube([TRANSDUCER_SIZE, 6, TRANSDUCER_SIZE], center = true);
}
module hardware() {
    color([.15, .35, .8]) hw_hat();
    color("red") hw_lever();
    color("silver") hw_screw_heads();
    color([.1, .55, .2]) hw_pi();
    color([.2, .2, .25]) hw_camera();
    color("white") hw_switch();
    color("orange") hw_transducer();
}
module hw_all() { hw_hat(); hw_lever(); hw_pi(); hw_camera(); hw_switch(); }

module assembly() {
    color("#2c2c2c") translate([0, -EXPLODE, 0]) left_body();
    color("#4a4a4a", 0.55) translate([0, EXPLODE, 0]) right_body();
    color("#d9d9d9") translate([0, EXPLODE, 0]) button_cap_placed();
    color("#d0a020") translate([0, -EXPLODE, 0]) power_slider();
    color("#1b1b1b") translate([0, -EXPLODE, 0]) bone_arm();
    if (SHOW_HW) hardware();
}

// ---------- Print orientation: each half lies on its flat outer face ----------
// the head-side face is flat but the arm socket and the elastic bridges stand 3.8 proud of it:
// the left half rests on them and needs supports under the flat face (README, Impresion)
module print_left() { translate([0, 0, -LEFT_FACE + 3.78]) rotate([90, 0, 0]) left_body(); }
module print_right() { translate([0, 0, RIGHT_FACE]) rotate([-90, 0, 0]) right_body(); }
module print_button() { rotate([90, 0, 0]) button_cap(); }
// the slider prints standing on its plate
module print_slider() { translate([0, 0, CAV_HY - 0.05 - 15.35]) rotate([-90, 0, 0]) translate([-(SLIDER_X[0] + SLIDER_X[1]) / 2, 0, 0]) power_slider(); }
module print_bone() { translate([0, 0, 22.0 + TRANSDUCER_OUTER / 2 - 45.16 - ARM_DY - 6.2]) rotate([-90, 0, 0]) bone_arm(); }

// ---------- Interference checks: every one of these must render EMPTY ----------
module check(name) {
    if (name == "halves") intersection() { left_body(); right_body(); }
    else if (name == "left_hw") intersection() { left_body(); hw_all(); }
    else if (name == "right_hw") intersection() { right_body(); union() { hw_all(); hw_screw_heads(); } }
    else if (name == "pads_heads") intersection() { left_body(); hw_screw_heads(); }
    else if (name == "button") intersection() { button_cap_placed(); union() { left_body(); right_body(); hw_switch(); hw_pi(); } }
    else if (name == "slider") intersection() { power_slider(); union() { left_body(); right_body(); hw_hat(); hw_lever(); hw_camera(); hw_pi(); } }
    else if (name == "bone") intersection() { bone_arm(); union() { left_body(); hw_transducer(); } }
    else if (name == "drawer_pi") intersection() { switch_drawer_solid(); hw_pi(); }
}

if (PART == "left") left_body();
else if (PART == "right") right_body();
else if (PART == "bone") bone_arm();
else if (PART == "button") button_cap();
else if (PART == "slider") power_slider();
else if (PART == "print_left") print_left();
else if (PART == "print_right") print_right();
else if (PART == "print_bone") print_bone();
else if (PART == "print_button") print_button();
else if (PART == "print_slider") print_slider();
else if (PART == "hardware") hardware();
else if (len(PART) > 6 && PART[0] == "c" && PART[1] == "h" && PART[5] == "_") check(chr([for (i = [6 : len(PART) - 1]) ord(PART[i])]));
else assembly();
