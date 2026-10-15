// VIA Clara v0.9 — two-half snap-fit case for Raspberry Pi Zero 2 W + Waveshare UPS HAT (C) with its
// 803040 battery + Raspberry Pi AI Camera (IMX500) + bone-conduction transducer.
//
// Changes from v0.8 (see README.md for the reasoning):
//   - no external screws: the halves close with in-plane snap beams + an alignment lip + two pins;
//   - no separate camera cap: the camera chamber is split between both halves, the PCB sits in an
//     edge slot with stops on all four edges (no pegs through its holes), one front lens opening;
//   - the screws under the UPS HAT are heat-staked into chassis pads before the boards go in
//     (no plastic pins through the Raspberry Pi holes, no heat on the boards);
//   - real stack: HAT, battery and pogo pins under the Pi, soldered male header on top;
//   - openings at the real connector positions: microSD and charging micro USB at the rear, the UPS
//     switch (front end of the HAT) through a printed slider on the head-side face;
//   - one mode button with its switch drawer; bone transducer pocket at 14 mm + fit clearance.
//
// Units: mm. Frame: X along the temple (front = -X, camera end), Y across (left half / head side
// is Y < 0, right half / outer side is Y > 0, parting plane Y = 0), Z up.
// Sources: Raspberry Pi Zero 2 W mechanical drawing, AI Camera product brief (Sept. 2024, page 4),
// Waveshare UPS HAT (C) wiki photos (positions scaled from the 65 x 30 board outline).
// Values tagged MEASURE are not in any drawing and must be checked with a caliper.

$fn = $preview ? 40 : 64;
PART = is_undef(PART) ? "assembly" : PART;
SHOW_HW = is_undef(SHOW_HW) ? true : SHOW_HW;
EXPLODE = is_undef(EXPLODE) ? 0 : EXPLODE;

// ---------- Board stack (X: front -> rear) ----------
PI_L = 65;
PI_W = 30;
PI_CX = 3.0;
STACK_FRONT_X = PI_CX - PI_L / 2;    // -29.5: Pi CSI connector + HAT switch end
STACK_REAR_X = PI_CX + PI_L / 2;     //  35.5: Pi microSD + HAT micro USB end
PI_HOLE_X = 29.0;                    // 58 x 23 hole pattern, shared by the Pi and the HAT
PI_HOLE_Z = 11.5;

// Pads under the HAT: round socket for the screw head + reflowable collar
// The brass standoffs of the stack stick out below the HAT: those stubs drop into hex sockets in the
// pads with the whole stack assembled (nothing is taken apart), and a plastic collar is melted onto
// each stub. The collar stays PAD_AIR below the HAT, so the iron touches plastic and brass, not the board.
PAD_D = 8.0;
STUB_AF = 5.0;                   // MEASURE: across flats of the brass standoff under the HAT
STUB_LEN = 3.0;                  // MEASURE: how far it sticks out below the HAT
PAD_FLOOR = 0.6;                 // plastic under the stub tip
PAD_AIR = 0.7;                   // gap between the collar and the HAT bottom
COLLAR_H = 0.8;
SOCKET_AF = STUB_AF + 0.2;       // sliding fit; the melted collar is what holds
SOCKET_DEPTH = STUB_LEN - PAD_AIR - COLLAR_H;           // 1.5 of stub inside the socket, 0.8 in the collar
COLLAR_ID = SOCKET_AF / cos(30) + 0.1;                  // just clears the hex corners, melted inward onto it
COLLAR_OD = PAD_D;

// Stack heights along Y (head side -> outer side)
HAT_PCB = 1.6;
HAT_UNDER = 0.9;                 // tallest part under the HAT (Waveshare STEP model)
BAT = [40, 30, 8];               // 803040, on the pogo-pin side of the HAT
HEADER_TAIL = 3.0;               // solder tails of the male header under the Pi
BOARD_GAP = BAT[2] + HEADER_TAIL + 0.3;   // MEASURE: HAT top face to Pi bottom face (11.3)
PI_PCB = 1.4;
PI_PARTS = 3.2;                  // connectors on the Pi top side
HEADER_H = 8.5;                  // male header above the Pi PCB (2.5 plastic + 6 pin)
HEADER_CLEAR = 0.6;
HEADER_Z = [9.0, 14.0];          // header band: top long edge (pin 1 at the microSD end)
// mini HDMI and the two micro USB on the bottom long edge (official drawing: centres 12.4 / 41.4 / 54
// from the microSD end), on the top side; they stand past the PCB edge
PI_PORTS = [[12.4, 11.2], [41.4, 8.0], [54.0, 8.0]];   // [centre from the microSD end, width]
PI_PORT_OVERHANG = 0.8;          // MEASURE: how far the connectors stand past the board edge

// ---------- Cavity and walls: the stack sets the width ----------
WALL = 2.2;
CAV_HY = (PAD_FLOOR + STUB_LEN + HAT_PCB + BOARD_GAP + PI_PCB + HEADER_H + HEADER_CLEAR) / 2;   // 13.5
CAV_HZ = 15.9;                   // 30 mm boards + 0.9
CAV_L = 67.2;
LEFT_FACE = -(CAV_HY + WALL);    // head side
RIGHT_FACE = CAV_HY + WALL;      // outer side
OUT_W = 2 * (CAV_HY + WALL);     // 31.2

HAT_BOTTOM_Y = -CAV_HY + PAD_FLOOR + STUB_LEN;
PAD_TOP_Y = HAT_BOTTOM_Y - PAD_AIR - COLLAR_H;          // socket mouth, collar on top of it
HAT_TOP_Y = HAT_BOTTOM_Y + HAT_PCB;
PI_BOTTOM_Y = HAT_TOP_Y + BOARD_GAP;
PI_TOP_Y = PI_BOTTOM_Y + PI_PCB;
HEADER_TOP_Y = PI_TOP_Y + HEADER_H;

// UPS HAT (C) parts in the HAT frame, scaled from the Waveshare photo: x from the switch end;
// case z = (distance from the edge opposite the pogo pins) - 15.
BAT_X0 = 6.5;                    // clear of the standoffs at x = 3.5
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

NOSE_X = -50.0;                  // 6 mm longer than v0.8: room for the camera flex to turn
CAM_FRONT_X = NOSE_X + 0.1 + AI_CAM_BARREL_REACH;    // barrel 0.1 inside the nose
CAM_BACK_X = CAM_FRONT_X + AI_CAM_PCB_T;
CAM_CONN_BACK_X = CAM_BACK_X + AI_CAM_CONN_REACH;    // -38.0: 8.5 mm to the Pi edge for the flex
LENS_Z = AI_CAM_H / 2 - AI_CAM_LENS_FROM_TOP;        // -2.47 with the board centred on Z = 0
LENS_HOLE_D = AI_CAM_BARREL_D + 0.85;                // clearance only: the slot locates the board

CHAMBER_FRONT_X = CAM_FRONT_X - AI_CAM_TIER_REACH - 0.3;
CHAMBER_HY = max(CAV_HY, AI_CAM_W / 2 + 0.9);
CHAMBER_HZ = 14.6;
CHAMBER_R = 3.5;
RIB_T = 0.65;
RIB_GAP = 0.05;                  // board thickness clearance, each side
RIB_OVERLAP = 0.8;               // how far the ribs cover the PCB edge
EDGE_CLEAR = 0.15;               // slot clearance around the board edges
CRUSH = EDGE_CLEAR + 0.05;       // crush ribs: they reach 0.05 into the board edge and centre it

// ---------- Snap fit: in-plane beams with a hook across the parting plane ----------
// The beam lies along X inside the right-half wall and flexes in Z, so on the print bed (outer
// face down) it bends within the layers, not across them. [hook centre X, hook width, cavity
// half height, side of the root (+1 = root at larger X), beam length, walls (2 = top and bottom,
// 1 = top only: the camera flex lies on the chamber floor, so the front snap has no bottom twin)]
SNAPS = [[-39.0, 4.0, CHAMBER_HZ, 1, 6.0, 1], [-12.0, 5.0, CAV_HZ, -1, 10.0, 2], [24.0, 5.0, CAV_HZ, -1, 10.0, 2]];
SNAP_T = 1.2;                    // beam / hook thickness (Z)
SNAP_DEPTH = 2.5;                // beam depth inside the right half (Y)
SNAP_GAP = 0.4;                  // relief above the beam and at its free end
SNAP_BACK_GAP = 0.7;             // relief behind the beam: room for bridge sag so it does not fuse to the wall
SNAP_WEB = 0.4;                  // breakaway web across the end slot: the beam prints as a bridge; cut it after printing
HOOK_LEN = 3.0;                  // hook reach past the parting plane
BUMP_H = 0.45;
SNAP_CLEAR = 0.05;               // recess roof over the hook: engagement = BUMP_H - SNAP_CLEAR
LIP_T = 1.2;
LIP_CLEAR = 0.2;
LIP_LEN = 2.5;
LIP_SEGMENTS = [[-43.6, -42.3, CHAMBER_HZ], [-30.5, -25.0, CAV_HZ], [-8.2, 11.0, CAV_HZ], [27.8, 34.0, CAV_HZ]];
LIP_FLOOR = [-43.6, -31.0];      // bottom-only lip where the front snap has no bottom twin
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
SWITCH_HEADROOM = 0.15;          // lets the actuator slide under the flange on insertion
BACKING_T = 0.8;
SW_TOP_Y = RIGHT_FACE - BUTTON_WALL - BUTTON_FLANGE_T;     // flange face
SW_BASE_Y = SW_TOP_Y - SWITCH_HEADROOM - SWITCH_T;
BACKING_Y = SW_BASE_Y - BACKING_T;

// ---------- Rear openings ----------
// The microSD is for the team only: it stays inside (open the case to reach it). The rear wall gets a
// blind pocket for the end of the card, which sticks out of the Pi edge.
SD_ZC = -1.9;                    // card centre, ~16.9 from the header edge
SD_CARD_OUT = 2.5;
CHARGE_PLUG = [11.5, 7.5];       // moulded micro USB plug: Z x Y

// ---------- Power slider (HAT switch, head-side face) ----------
// One solid with a common X range, so it prints lying flat on its -X face.
SLIDER_X = [-34.8, -30.4];       // behind the flex rise (x -38 .. -35), over the lever
SLIDER_PLATE_X1 = -30.15;        // the plate ends just short of the front pads (x -30)
SLIDER_KNOB_Z = 4.0;
SLIDER_KNOB_PROUD = 1.5;
SLIDER_PLATE_T = 1.0;
SLIDER_PRONG_T = 1.2;
SLIDER_CLEAR = 0.35;
SLIDER_S = LEVER_TRAVEL / 2 + SLIDER_CLEAR;          // knob stroke each way from centre
SLIDER_WIN_Z = SLIDER_KNOB_Z + 2 * SLIDER_S + 0.4;
SLIDER_TOP = CHAMBER_HZ - CHAMBER_R - 0.1;           // where the chamber wall starts to round off
SLIDER_P1 = SLIDER_TOP - SLIDER_S;                   // plate top, slider-local
SLIDER_W1 = SLIDER_P1 - SLIDER_S - 0.8;              // window top: the plate overlaps it by 0.8 at ON
SLIDER_W0 = SLIDER_W1 - SLIDER_WIN_Z;
SLIDER_P0 = SLIDER_W0 - SLIDER_S - 0.8;              // plate bottom: overlaps by 0.8 at OFF
SLIDER_KNOB_C = (SLIDER_W0 + SLIDER_W1) / 2;

// ---------- Elastic channel, bone arm ----------
ELASTIC_XS = [-19.5, 12.5];
ELASTIC_W = 7.0;
ELASTIC_GAP = 2.5;               // bridges reach the same plane as the arm boss (3.8 proud)
ELASTIC_BRIDGE_T = 1.6;
ELASTIC_LEN = 12.0;

ARM_DY = LEFT_FACE + 12.1;       // the arm socket follows the head-side face (v0.8 had it at -12.1)
TRANSDUCER_SIZE = 14.0;          // MEASURE: the transducer's real size
TRANSDUCER_CLEAR = 0.2;
TRANSDUCER_INNER = TRANSDUCER_SIZE + 2 * TRANSDUCER_CLEAR;
TRANSDUCER_WALL = 2.2;
TRANSDUCER_OUTER = TRANSDUCER_INNER + 2 * TRANSDUCER_WALL;
TRANSDUCER_CENTER = [69.0, -22.0 + ARM_DY, -16.0];
TRANSDUCER_DEPTH = 7.4;

// Outer shape: X, total Y width, total Z height, corner radius. Flat sides between -47 and 30.
stations = [
    [-50.0, OUT_W - 1.4, 31.4, 5.4],
    [-47.0, OUT_W, 33.2, 5.8],
    [-42.0, OUT_W, 34.6, 6.0],
    [-31.0, OUT_W, 37.2, 6.2],
    [-24.0, OUT_W, 37.6, 6.4],      // >= 1.1 of skin over the snap grooves and lip recesses
    [ 30.0, OUT_W, 37.6, 6.4],
    [ 35.0, OUT_W - 0.2, 37.2, 6.2],
    [ 37.6, OUT_W - 0.8, 34.8, 6.0],
    [ 39.8, OUT_W - 2.8, 30.6, 5.6],
    [ 41.6, OUT_W - 6.8, 25.0, 5.0]
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
module box(p0, p1) { translate([min(p0[0], p1[0]), min(p0[1], p1[1]), min(p0[2], p1[2])]) cube([abs(p1[0] - p0[0]), abs(p1[1] - p0[1]), abs(p1[2] - p0[2])]); }
module hex_y(af, h) { rotate([-90, 0, 0]) rotate([0, 0, 30]) cylinder(h = h, r = af / sqrt(3), $fn = 6); }
module half_space(side) { translate([0, side * 100, 0]) cube([200, 200, 200], center = true); }
module both_walls(n = 2) { children(); if (n > 1) mirror([0, 0, 1]) children(); }
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
    // microSD: blind pocket inside the rear wall for the end of the card (no hole to the outside)
    box([STACK_REAR_X - 0.5, PI_TOP_Y - 0.3, SD_ZC - 6.5], [STACK_REAR_X + SD_CARD_OUT + 0.6, PI_TOP_Y + 2.0, SD_ZC + 6.5]);
    // charging micro USB of the HAT: straight channel for the moulded plug
    translate([STACK_REAR_X + 5, HAT_TOP_Y + USB_H / 2, (USB_Z[0] + USB_Z[1]) / 2]) rounded_box3d([12, CHARGE_PLUG[1], CHARGE_PLUG[0]], 1.5);
}

// ---------- Camera slot: ribs in front of and behind the PCB, stops on its four edges ----------
module camera_frame() {
    front0 = CAM_FRONT_X - RIB_GAP - RIB_T;
    back1 = CAM_BACK_X + RIB_GAP + RIB_T;
    ey = AI_CAM_W / 2 - RIB_OVERLAP;
    ez = AI_CAM_H / 2 - RIB_OVERLAP;
    intersection() {
        chamber();
        difference() {
            box([front0, -50, -50], [back1, 50, 50]);
            // the board itself, with clearance on the thickness and on the four edges
            box([CAM_FRONT_X - RIB_GAP, -AI_CAM_W / 2 - EDGE_CLEAR, -AI_CAM_H / 2 - EDGE_CLEAR],
                [CAM_BACK_X + RIB_GAP, AI_CAM_W / 2 + EDGE_CLEAR, AI_CAM_H / 2 + EDGE_CLEAR]);
            // open window: optics in front, parts behind
            box([front0 - 1, -ey, -ez], [back1 + 1, ey, ez]);
            // the FPC connector and the flex leave the back of the board at the bottom edge
            box([CAM_BACK_X, -AI_CAM_CONN_W / 2 - 0.6, -50], [back1 + 1, AI_CAM_CONN_W / 2 + 0.6, -ez]);
        }
    }
}

// Crush ribs on the top and bottom edges of the slot, running along Y, the direction the board goes in
// (-Y into the left half, then the right half closes the same way). Side ribs would stand across that
// path, so in Y the board keeps the 0.15 clearance (well inside the lens hole's 0.42). At 0.05 they are
// close to FDM tolerance: they take up play rather than locate precisely
module camera_crush_ribs() {
    x0 = CAM_FRONT_X + 0.02; x1 = CAM_BACK_X - 0.02;      // only across the board thickness, clear of the connector
    for (y = [-AI_CAM_W / 4, AI_CAM_W / 4], s = [-1, 1])        // top and bottom edges
        box([x0, y - 0.3, s * (AI_CAM_H / 2 + EDGE_CLEAR + 0.01)], [x1, y + 0.3, s * (AI_CAM_H / 2 + EDGE_CLEAR - CRUSH)]);
}

// The camera flex leaves the connector downward, turns back under the camera and rises to the Pi CSI
// (Pi top side, front edge). Nothing solid may enter this volume.
module flex_keepout() {
    // the chamber corners are rounded (CHAMBER_R): the flat floor and side walls start at +/-fy
    // route: down from the connector, back along the floor, up across its full width between the
    // connector and the slider, a 45 deg fold, then flat into the CSI on the Pi side (Y > 0)
    fy = CHAMBER_HY - CHAMBER_R;
    box([CAM_BACK_X + 0.2, -fy, -CHAMBER_HZ], [STACK_FRONT_X, fy, -AI_CAM_H / 2]);
    box([CAM_CONN_BACK_X, -fy, -CHAMBER_HZ], [SLIDER_X[0] - 0.2, fy, CHAMBER_HZ - 4]);
    box([SLIDER_X[0] - 0.2, -1.0, -CHAMBER_HZ], [STACK_FRONT_X, fy, CHAMBER_HZ - 4]);
}

// ---------- Pads ----------
module pad_solid() {
    translate([0, -CAV_HY - 0.5, 0]) rotate([-90, 0, 0]) cylinder(h = PAD_TOP_Y + CAV_HY + 0.5, d = PAD_D);
    // reflowable collar: the iron touches this ring and the brass stub, never a board
    translate([0, PAD_TOP_Y - 0.01, 0]) rotate([-90, 0, 0])
        difference() { cylinder(h = COLLAR_H, d = COLLAR_OD); cylinder(h = 3, d = COLLAR_ID, center = true); }
}
module pad_socket() { translate([0, PAD_TOP_Y - SOCKET_DEPTH, 0]) hex_y(SOCKET_AF, SOCKET_DEPTH + 2); }
module pad_positions() { for (dx = [-PI_HOLE_X, PI_HOLE_X], z = [-PI_HOLE_Z, PI_HOLE_Z]) translate([PI_CX + dx, 0, z]) children(); }

// ---------- Power slider: a knob on the head-side face drives the HAT switch lever ----------
// a raised dot below the window marks the ON end of the stroke (knob down)
module slider_on_dot() {
    translate([(SLIDER_X[0] + SLIDER_X[1]) / 2, LEFT_FACE + 0.3, SLIDER_W0 - 1.6]) rotate([90, 0, 0]) cylinder(h = 0.9, d1 = 1.8, d2 = 1.2, $fn = 24);
}
module slider_window() {
    box([SLIDER_X[0] - 0.2, LEFT_FACE - 1, SLIDER_W0], [SLIDER_X[1] + 0.2, -CHAMBER_HY + 0.01, SLIDER_W1]);
}
// s = slider position (+SLIDER_S pushes the lever to OFF, -SLIDER_S to ON)
module power_slider(s = SLIDER_S) {
    ly0 = HAT_TOP_Y + LEVER_Y[0];
    ly1 = HAT_TOP_Y + LEVER_Y[1];
    gap = LEVER_W / 2 + SLIDER_CLEAR;
    plate_y = -CHAMBER_HY + 0.05;
    translate([0, 0, s]) union() {
        // knob through the window, with three grip ridges across the stroke
        box([SLIDER_X[0], LEFT_FACE - SLIDER_KNOB_PROUD, SLIDER_KNOB_C - SLIDER_KNOB_Z / 2], [SLIDER_X[1], plate_y + 0.5, SLIDER_KNOB_C + SLIDER_KNOB_Z / 2]);
        for (dz = [-1.2, 0, 1.2]) translate([SLIDER_X[0], LEFT_FACE - SLIDER_KNOB_PROUD, SLIDER_KNOB_C + dz]) rotate([0, 90, 0]) cylinder(h = SLIDER_X[1] - SLIDER_X[0], d = 0.8, $fn = 12);
        // plate inside the wall
        box([SLIDER_X[0], plate_y, SLIDER_P0], [SLIDER_PLATE_X1, plate_y + SLIDER_PLATE_T, SLIDER_P1]);
        // web and fork around the lever
        box([SLIDER_X[0], plate_y + 0.5, -gap - SLIDER_PRONG_T], [SLIDER_X[1], ly0 - 0.4, gap + SLIDER_PRONG_T]);
        for (sz = [-1, 1]) box([SLIDER_X[0], ly0 - 0.5, sz * gap], [SLIDER_X[1], ly1 + 0.6, sz * (gap + SLIDER_PRONG_T)]);
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
module bone_cable_port() { translate([29, -CAV_HY + 2, -.5]) rotate([90, 0, 0]) cylinder(h = 13, d = 3.4); }

// ---------- Snap beams, lip, pins ----------
function snap_free(t) = t[0] - t[3] * t[1] / 2;              // free end of the beam (hook side)
function snap_root(t) = t[0] + t[3] * (t[1] / 2 + t[4]);
module snap_hooks() {
    for (t = SNAPS) both_walls(t[5]) {
        x0 = t[0] - t[1] / 2; x1 = t[0] + t[1] / 2; hz = t[2];
        box([x0, -HOOK_LEN, hz], [x1, 0.01, hz + SNAP_T]);
        // lead-in ramp toward the tip (~24 deg), 45 deg retention face toward the root
        yb = -HOOK_LEN + 0.1;
        translate([x0, 0, hz + SNAP_T - 0.01]) rotate([90, 0, 90]) linear_extrude(height = t[1])
            polygon([[yb, 0], [yb + 1.0, BUMP_H], [yb + 1.4, BUMP_H], [yb + 1.4 + BUMP_H, 0]]);
    }
}
module snap_reliefs() {
    // free the beam from the right-half wall on every side except its root
    for (t = SNAPS) both_walls(t[5]) {
        f = snap_free(t); r = snap_root(t); hz = t[2]; e = f - t[3] * 0.8;
        box([e, -0.01, hz + SNAP_T], [r, SNAP_DEPTH + SNAP_GAP, hz + SNAP_T + SNAP_GAP]);
        box([e, SNAP_DEPTH, hz - 0.01], [r, SNAP_DEPTH + SNAP_BACK_GAP, hz + SNAP_T + SNAP_GAP]);
        box([e, -0.01, hz - 0.01], [f, SNAP_DEPTH + SNAP_BACK_GAP, hz + SNAP_T + SNAP_GAP]);
    }
}
module snap_recesses() {
    for (t = SNAPS) both_walls(t[5]) {
        x0 = t[0] - t[1] / 2 - 0.3; x1 = t[0] + t[1] / 2 + 0.3; hz = t[2];
        box([x0, -HOOK_LEN - 0.3, hz - 0.01], [x1, 0.01, hz + SNAP_T + SNAP_CLEAR]);
        // groove: covers the bump wherever it stands above the recess roof, so the closed case
        // carries no load; its +Y wall is the retention shoulder
        yb = -HOOK_LEN + 0.1;
        box([x0, yb + SNAP_CLEAR / BUMP_H - 0.06, hz + SNAP_T], [x1, yb + 1.4 + BUMP_H + 0.05, hz + SNAP_T + BUMP_H + 0.1]);
    }
}
module snap_webs() {
    // bridges the end slot, from the beam's free end to the wall, over the beam's back layers: the beam
    // prints as a bridge from root to web; a blade pushed down the end slot cuts it after printing
    for (t = SNAPS) both_walls(t[5]) {
        f = snap_free(t); hz = t[2]; e = f - t[3] * 0.8;
        box([e - t[3] * 0.01, SNAP_DEPTH - SNAP_WEB, hz], [f + t[3] * 0.01, SNAP_DEPTH + SNAP_BACK_GAP + 0.01, hz + SNAP_T]);
    }
}
module lip_band(x0, x1, hz, len) { box([x0, -len, hz], [x1, 0.01, hz + LIP_T]); }
module lips_right() {
    for (s = LIP_SEGMENTS) both_walls() lip_band(s[0], s[1], s[2], LIP_LEN);
    mirror([0, 0, 1]) lip_band(LIP_FLOOR[0], LIP_FLOOR[1], CHAMBER_HZ, LIP_LEN);
    for (p = PINS) translate([p[0], 0.01, p[1]]) rotate([90, 0, 0]) {
        cylinder(h = PIN_LEN - 0.5, d = PIN_D);
        translate([0, 0, PIN_LEN - 0.51]) cylinder(h = 0.5, d1 = PIN_D, d2 = PIN_D - 0.8);
    }
}
module lip_recesses_left() {
    for (s = LIP_SEGMENTS) both_walls() box([s[0] - 0.3, -LIP_LEN - 0.3, s[2] - 0.01], [s[1] + 0.3, 0.01, s[2] + LIP_T + LIP_CLEAR]);
    mirror([0, 0, 1]) box([LIP_FLOOR[0] - 0.3, -LIP_LEN - 0.3, CHAMBER_HZ - 0.01], [LIP_FLOOR[1] + 0.3, 0.01, CHAMBER_HZ + LIP_T + LIP_CLEAR]);
    for (p = PINS) translate([p[0], 0.01, p[1]]) rotate([90, 0, 0]) cylinder(h = PIN_LEN + 0.4, d = PIN_HOLE_D);
    translate([40.5, 0, -4]) rounded_box3d([6, 1.6, 5], 0.4);   // pry notch at the rear seam, clear of the pins
}

// ---------- Button drawer (right half) ----------
BAY_W = SWITCH_W + 2 * SWITCH_LEGS + 0.2;   // snug: friction plus a drop of glue holds the switch
BAY_TOP = BUTTON_Z + BUTTON_FLANGE_D / 2 + 0.25;   // the cap's flange travels up the bay
CAP_LANE = 0.3;                  // extra depth for the cap's head while it slides up
module switch_drawer_solid() {
    w = BAY_W + 2.0;                 // 1.0 side walls: the snug fit depends on them
    box([BUTTON_X - w / 2, BACKING_Y, BUTTON_Z - SWITCH_W / 2 - 1.2], [BUTTON_X + w / 2, CAV_HY + 0.5, BAY_TOP + 0.9]);
}
module switch_drawer_cut() {
    // switch bay, open toward -Z: the switch slides up into it and the wires leave downward
    box([BUTTON_X - BAY_W / 2, SW_BASE_Y, BUTTON_Z - SWITCH_W / 2 - 3], [BUTTON_X + BAY_W / 2, SW_TOP_Y + 0.01, BAY_TOP]);
    // entry channel in the wall below the drawer: the cap (flange first) and then the switch come up
    // from the cavity without scraping the inner wall face
    box([BUTTON_X - BAY_W / 2, CAV_HY - 0.01, BUTTON_Z - 16], [BUTTON_X + BAY_W / 2, SW_TOP_Y + CAP_LANE, BUTTON_Z - SWITCH_W / 2 - 2.9]);
    // flange pocket, extended down to the bay mouth: the cap slides up the bay with its flange in
    // this slot, then steps into its hole; the switch goes in after it and keeps it there
    translate([BUTTON_X, SW_TOP_Y - 0.01, BUTTON_Z]) rotate([-90, 0, 0]) cylinder(h = BUTTON_FLANGE_T + 0.02, d = BUTTON_FLANGE_D + 0.5);
    // shallow lane for the head on its way up (the cap is 0.14 longer than the bay is deep); it stays
    // shallow under the finder ring so the outer skin there keeps > 1 mm
    box([BUTTON_X - BUTTON_HEAD_D / 2 - 0.25, SW_TOP_Y - 0.01, BUTTON_Z - SWITCH_W / 2 - 3], [BUTTON_X + BUTTON_HEAD_D / 2 + 0.25, SW_TOP_Y + CAP_LANE, BUTTON_Z]);
    translate([BUTTON_X, SW_TOP_Y, BUTTON_Z]) rotate([-90, 0, 0]) cylinder(h = 10, d = BUTTON_HOLE_D);
    // finder ring around the button, to locate it by touch
    translate([BUTTON_X, RIGHT_FACE - 0.6, BUTTON_Z]) rotate([-90, 0, 0])
        difference() { cylinder(h = 2, d = 11.6); cylinder(h = 5, d = 9.0, center = true); }
}

// ---------- Halves ----------
module left_body() {
    difference() {
        union() {
            intersection() { difference() { outer_shell(); cavity(); } half_space(-1); }
            intersection() { union() { camera_frame(); camera_crush_ribs(); } half_space(-1); }
            pad_positions() pad_solid();
            elastic_bridges();
            bone_socket_boss();
            slider_on_dot();
        }
        pad_positions() pad_socket();
        lens_opening();
        rear_openings();
        slider_window();
        snap_recesses();
        lip_recesses_left();
        bone_socket_cut();
        bone_cable_port();
    }
}

module right_body() {
    difference() {
        union() {
            intersection() { difference() { outer_shell(); cavity(); } half_space(1); }
            intersection() { union() { camera_frame(); camera_crush_ribs(); } half_space(1); }
            switch_drawer_solid();
            snap_hooks();
            lips_right();
        }
        lens_opening();
        rear_openings();
        snap_reliefs();
        switch_drawer_cut();
    }
    snap_webs();
}

// ---------- Button cap ----------
// model frame: axis along +Y, flange face at SW_TOP_Y; a sunken ring on the head marks it
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
    box([hat_x(BAT_X0), HAT_TOP_Y, -BAT[1] / 2], [hat_x(BAT_X0 + BAT[0]), HAT_TOP_Y + BAT[2], BAT[1] / 2]);
    box([hat_x(SW_BODY_X[0]), HAT_TOP_Y, SW_BODY_Z[0]], [hat_x(SW_BODY_X[1]), HAT_TOP_Y + SW_BODY_H, SW_BODY_Z[1]]);
    box([hat_x(USB_X[0]), HAT_TOP_Y, USB_Z[0]], [hat_x(USB_X[1]), HAT_TOP_Y + USB_H, USB_Z[1]]);
    box([hat_x(JST_X[0]), HAT_TOP_Y, JST_Z[0]], [hat_x(JST_X[1]), HAT_TOP_Y + JST_H, JST_Z[1]]);
}
// lever centre at +LEVER_TRAVEL/2 (OFF) or -LEVER_TRAVEL/2 (ON)
module hw_lever(on = false) {
    zc = (on ? -1 : 1) * LEVER_TRAVEL / 2;
    box([hat_x(-LEVER_TIP), HAT_TOP_Y + LEVER_Y[0], zc - LEVER_W / 2], [hat_x(SW_BODY_X[0]), HAT_TOP_Y + LEVER_Y[1], zc + LEVER_W / 2]);
}
module hw_stubs() { pad_positions() translate([0, HAT_BOTTOM_Y - STUB_LEN, 0]) hex_y(STUB_AF, STUB_LEN); }
module hw_pi() {
    box([STACK_FRONT_X, PI_BOTTOM_Y, -PI_W / 2], [STACK_REAR_X, PI_TOP_Y, PI_W / 2]);
    box([STACK_FRONT_X, PI_TOP_Y, -PI_W / 2], [STACK_REAR_X, PI_TOP_Y + PI_PARTS, HEADER_Z[0]]);
    // male header above, solder tails below
    box([STACK_REAR_X - 57.9, PI_TOP_Y, HEADER_Z[0]], [STACK_REAR_X - 7.1, HEADER_TOP_Y, HEADER_Z[1]]);
    box([STACK_REAR_X - 57.9, PI_BOTTOM_Y - HEADER_TAIL, HEADER_Z[0]], [STACK_REAR_X - 7.1, PI_BOTTOM_Y, HEADER_Z[1]]);
    for (p = PI_PORTS) box([STACK_REAR_X - p[0] - p[1] / 2, PI_TOP_Y, -PI_W / 2 - PI_PORT_OVERHANG], [STACK_REAR_X - p[0] + p[1] / 2, PI_TOP_Y + PI_PARTS, -PI_W / 2 + 5]);
    // microSD card sticking out of the rear edge
    box([STACK_REAR_X - 4, PI_TOP_Y + 0.2, SD_ZC - 5.5], [STACK_REAR_X + SD_CARD_OUT, PI_TOP_Y + 1.2, SD_ZC + 5.5]);
    // standoffs between the boards
    pad_positions() translate([0, HAT_TOP_Y, 0]) hex_y(5.0, BOARD_GAP);
}
// squeeze trims the PCB top and bottom edges: the checks use CRUSH - EDGE_CLEAR so the crush ribs' designed
// 0.05 interference is not reported as a clash (everything else on the camera is checked as is)
module hw_camera(squeeze = 0) {
    box([CAM_FRONT_X, -AI_CAM_W / 2, -AI_CAM_H / 2 + squeeze], [CAM_BACK_X, AI_CAM_W / 2, AI_CAM_H / 2 - squeeze]);
    box([CAM_FRONT_X - AI_CAM_BLOCK_REACH, -AI_CAM_BLOCK_W / 2, -AI_CAM_H / 2 + AI_CAM_BLOCK_Z[0]], [CAM_FRONT_X, AI_CAM_BLOCK_W / 2, -AI_CAM_H / 2 + AI_CAM_BLOCK_Z[1]]);
    translate([CAM_FRONT_X - AI_CAM_TIER_REACH, -AI_CAM_TIER / 2, LENS_Z - AI_CAM_TIER / 2]) cube([AI_CAM_TIER_REACH, AI_CAM_TIER, AI_CAM_TIER]);
    translate([CAM_FRONT_X, 0, LENS_Z]) rotate([0, -90, 0]) cylinder(h = AI_CAM_BARREL_REACH, d = AI_CAM_BARREL_D);
    box([CAM_BACK_X, -AI_CAM_CONN_W / 2, -AI_CAM_H / 2], [CAM_CONN_BACK_X, AI_CAM_CONN_W / 2, -AI_CAM_H / 2 + AI_CAM_CONN_H]);
}
module hw_switch() {
    box([BUTTON_X - SWITCH_W / 2 - SWITCH_LEGS, SW_BASE_Y, BUTTON_Z - SWITCH_W / 2], [BUTTON_X + SWITCH_W / 2 + SWITCH_LEGS, SW_BASE_Y + SWITCH_T, BUTTON_Z + SWITCH_W / 2]);
}
module hw_transducer() {
    translate([TRANSDUCER_CENTER[0], TRANSDUCER_CENTER[1] - 2.2, TRANSDUCER_CENTER[2]]) cube([TRANSDUCER_SIZE, 6, TRANSDUCER_SIZE], center = true);
}
module hardware() {
    color([.15, .35, .8]) hw_hat();
    color("red") hw_lever();
    color("goldenrod") hw_stubs();
    color([.1, .55, .2]) hw_pi();
    color([.2, .2, .25]) hw_camera();
    color("white") hw_switch();
    color("orange") hw_transducer();
}
module hw_all() { hw_hat(); hw_lever(); hw_pi(); hw_camera(CRUSH - EDGE_CLEAR + 0.02); hw_switch(); }

module assembly() {
    color("#2c2c2c") translate([0, -EXPLODE, 0]) left_body();
    color("#4a4a4a", 0.55) translate([0, EXPLODE, 0]) right_body();
    color("#d9d9d9") translate([0, EXPLODE, 0]) button_cap_placed();
    color("#d0a020") translate([0, -EXPLODE, 0]) power_slider();
    color("#1b1b1b") translate([0, -EXPLODE, 0]) bone_arm();
    if (SHOW_HW) hardware();
}

// ---------- Print orientation ----------
// left half: rests on the flat tops of the arm boss and the elastic bridges (3.8 proud of the
// head-side face), with supports under the face; right half: on its flat outer face
module print_left() { translate([0, 0, -LEFT_FACE + 3.8]) rotate([90, 0, 0]) left_body(); }
module print_right() { translate([0, 0, RIGHT_FACE]) rotate([-90, 0, 0]) right_body(); }
module print_button() { rotate([90, 0, 0]) button_cap(); }
// the slider lies on its common -X face
module print_slider() { translate([0, 0, -SLIDER_X[0]]) rotate([0, -90, 0]) power_slider(0); }
// lying down; the offset is the measured lowest point of the rotated arm (export.sh checks that
// every print part sits on the bed, so a change that moves the arm fails loudly)
BONE_PRINT_Z = ARM_DY - 13.76;    // follows the arm when the head-side face moves (-17.26 at ARM_DY -3.5)
module print_bone() { translate([0, 0, BONE_PRINT_Z]) rotate([-90, 0, 0]) bone_arm(); }

// ---------- Interference checks: every one of these must render EMPTY (or zero-volume contact) ----------
module check(name) {
    if (name == "halves") intersection() { left_body(); right_body(); }
    else if (name == "left_hw") intersection() { left_body(); hw_all(); }
    else if (name == "right_hw") intersection() { right_body(); union() { hw_all(); hw_stubs(); } }
    else if (name == "pads_stubs") intersection() { left_body(); hw_stubs(); }
    else if (name == "button") intersection() { button_cap_placed(); union() { left_body(); right_body(); hw_switch(); hw_pi(); } }
    else if (name == "slider_off") intersection() { power_slider(SLIDER_S); union() { left_body(); right_body(); hw_hat(); hw_lever(false); hw_camera(); hw_pi(); } }
    else if (name == "slider_on") intersection() { power_slider(-SLIDER_S); union() { left_body(); right_body(); hw_hat(); hw_lever(true); hw_camera(); hw_pi(); } }
    else if (name == "flex") intersection() { flex_keepout(); union() { left_body(); right_body(); power_slider(SLIDER_S); power_slider(-SLIDER_S); hw_hat(); hw_lever(); hw_lever(true); } }
    else if (name == "hw_self") intersection() { hw_hat(); hw_pi(); }
    else if (name == "bone") intersection() { bone_arm(); union() { left_body(); hw_transducer(); } }
    else if (name == "drawer_pi") intersection() { switch_drawer_solid(); hw_pi(); }
    // assembly paths, not just the final positions. The cap goes up low in the bay (flange against the
    // backing), then steps out into its hole: those two legs are the whole path
    else if (name == "cap_insert") intersection() { right_body(); union() {
        for (dz = [-12 : 0.5 : 0]) translate([BUTTON_X, SW_BASE_Y + 0.02, BUTTON_Z + dz]) button_cap();
        for (dy = [SW_BASE_Y + 0.02 - SW_TOP_Y : 0.1 : 0]) translate([BUTTON_X, SW_TOP_Y + dy, BUTTON_Z]) button_cap(); } }
    else if (name == "switch_insert") intersection() { union() { right_body(); button_cap_placed(); } hull() for (dz = [-12, 0]) translate([0, 0, dz]) hw_switch(); }
    // the HAT goes in after the slider: its lever drops into the fork moving -Y
    else if (name == "lever_insert") intersection() { power_slider(SLIDER_S); hull() for (dy = [0, 8]) translate([0, dy, 0]) hw_lever(false); }
    else assert(false, str("unknown check: ", name));
}

if (PART == "left") left_body();
else if (PART == "right") right_body();
else if (PART == "bone") bone_arm();
else if (PART == "button") button_cap();
else if (PART == "slider") power_slider();
else if (PART == "button_placed") button_cap_placed();
else if (PART == "print_left") print_left();
else if (PART == "print_right") print_right();
else if (PART == "print_bone") print_bone();
else if (PART == "print_button") print_button();
else if (PART == "print_slider") print_slider();
else if (PART == "hardware") hardware();
else if (PART == "none") { }
else if (len(PART) > 6 && PART[0] == "c" && PART[1] == "h" && PART[5] == "_") check(chr([for (i = [6 : len(PART) - 1]) ord(PART[i])]));
else assembly();
