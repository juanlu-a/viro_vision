// VIA Clara v0.20 — two-half snap-fit case for Raspberry Pi Zero 2 W + Waveshare UPS HAT (C) with its
// 803040 battery + Raspberry Pi AI Camera (IMX500) + bone-conduction transducer.
//
// v0.20, the version to print whole: the panel slide switch goes into the head-side wall. The window is 4.2
// wide (was 5.2) and 2 mm lower, so a ~20 mm flange clears the chamber's top corner, and two Ø2.3 pins
// 14.8 apart, 2 mm tall, hold the switch's flange through its screw holes (found with the test_panel_switch
// prints); glue fixes it. The printed slider (part 05) is gone. Curves at 128 segments instead of 64.
//
// v0.19: the panel switch test again, now a single window: of the v0.18 pitches the 14.0 one
// was closest but needs 0.5 more (14.5); pins twice as thick (Ø3) and 2 mm tall.
//
// v0.18: a panel slide switch glued in the head-side wall replaces the HAT switch and the
// printed slider; test_panel_switch finds the pin spacing first.
//
// v0.17: the transducer cup 2 mm wider (Ø17); the Ø14 transducer did not go into the Ø15 one.
//
// v0.16, after printing the v0.15 (almost right): hex sockets 2 mm deeper (3.5), the halves did not close.
//
// v0.15, the user's review of the v0.14: hollow hex sockets (5.0 AF) again instead of pins; a solid
// transducer cover with one slot toward the ear; the slider knob 1 mm prouder, a square pocket on the
// lever and longer pocket walls; the button a plain cylinder 2 mm longer.
//
// v0.14, after the v0.13 test prints (camera right): a Ø1.8 pin into the hole of each hex above the Pi
// instead of a socket; a round cup for the round transducer (Ø15 x 6) with a snap-on grille (part 07);
// no button lid (the button holds in its pocket).
//
// v0.13, after the v0.12 test prints: camera slot 0.2 wider, the camera 1 mm forward so the flex is not
// forced, the front rib open at the corner where a small part sits, and a hex-socket size test.
//
// v0.12, after printing the v0.11 (see README.md): 5.0 from the front camera rib to the front wall, so
// the lens fits (it was 2.65).
//
// v0.11, after printing the v0.10: the power-switch window sized to the switch itself; a
// camera slot without fine features (1.2 ribs, no crush ribs); the mode button moved off the Pi's heatsink;
// the microSD space mirrored to the real slot and open at the rear end; a bone-arm joint that fits; a
// shorter nose and a hollow rear end.
//
// v0.10, after the first print of the v0.9:
//   - the brass hex standoffs stand above the Pi (same side as the header) and only Phillips screw heads
//     sit under the HAT: the hexes drop into loose sockets in the RIGHT half and the left wall rests on
//     the screw heads, so the stack comes out without tools (no heat-staking for now);
//   - real room for the microSD card at the rear (the v0.9 print had to be cut);
//   - thinner walls (1.6 on the sides, 2.7 top and bottom where the snap beams live) and a cavity that
//     follows the stack: 28.45 x 37.2 instead of 31.4 x 37.6;
//   - camera turned 90 degrees in its plane so the picture matches the wearer's view: the FPC connector
//     sits on the +Y edge (Pi side) and the flex runs straight to the CSI without a twist;
//   - room in front of the PCB for the camera's square lens holder, and a bottom twin for the front snap
//     now that the flex no longer lies on the chamber floor; a wider power slider knob.
//
// Units: mm. Frame: X along the temple (front = -X, camera end), Y across (left half / head side
// is Y < 0, right half / outer side is Y > 0, parting plane Y = 0), Z up.
// Sources: Raspberry Pi Zero 2 W mechanical drawing, AI Camera product brief (Sept. 2024, page 4),
// Waveshare UPS HAT (C) wiki photos, and the v0.9 test print. Values tagged MEASURE must be checked
// with a caliper.

$fn = $preview ? 40 : 128;     // v0.20: 64 left visible facets on the round parts
PART = is_undef(PART) ? "assembly" : PART;
SHOW_HW = is_undef(SHOW_HW) ? true : SHOW_HW;
EXPLODE = is_undef(EXPLODE) ? 0 : EXPLODE;
// Two versions of the same case:
//   "integrated": the camera sits inside the two halves (two-piece body);
//   "cap": the nose is a separate camera cap (three-piece body). The camera board sits on four posts
//   through its mounting holes, and a ring on the back of the cap goes into the body, where the two
//   halves trap its bead when they close: no screws, no clips to break.
VARIANT = is_undef(VARIANT) ? "integrated" : VARIANT;
CAP = VARIANT == "cap";

// ---------- Board stack (X: front -> rear) ----------
PI_L = 65;
PI_W = 30;
PI_CX = 3.0;
STACK_FRONT_X = PI_CX - PI_L / 2;    // -29.5: Pi CSI connector + HAT switch end
STACK_REAR_X = PI_CX + PI_L / 2;     //  35.5: Pi microSD + HAT micro USB end
PI_HOLE_X = 29.0;                    // 58 x 23 hole pattern, shared by the Pi and the HAT
PI_HOLE_Z = 11.5;

// Under the HAT only the Phillips screw heads stick out.
SCREW_HEAD_D = 4.5;              // MEASURE
SCREW_HEAD_H = 1.8;              // MEASURE
UNDER_CLEAR = 0.05;              // the left wall rests on the screw heads: with the hex sockets, that holds the stack

// Above the Pi the hexes stand only 1.2 (measured): too little to heat-stake without heating the board.
// The stack is held by the closed case instead: posts on the right half locate it on those hexes, and
// the left wall rests on the screw heads under the HAT.
HEX_AF = 4.8;                    // the 5.0 socket of test_hex_sizes fits it (2026-10-26)
HEX_H = 1.2;                     // measured: how far it stands above the Pi's top face
HEX_HOLE_D = 2.2;                // measured: the hole in the top of each hex (the first "2.2" was this)
// Hollow hex sockets like socket 5 of test_hex_sizes (user, 2026-10-26). The right half prints outer face
// down, so the sockets open upward and need no support inside. A post that wraps a 5 mm hex is ~8 mm
// across: it is cut back where it would reach the GPIO header or the ports (pi_tall_parts).
HEX_ENGAGE = 1.0;                // how much of the hex goes into the socket
SOCKET_AF = 5.0;
SOCKET_DEPTH = HEX_ENGAGE + 0.5 + 2.0;   // v0.15 print: 1.5 lifted the stack and the halves did not close
PAD_D = SOCKET_AF * 2 / sqrt(3) + 2.4;   // 8.2: 1.2 of wall at the socket corners

// Stack heights along Y (head side -> outer side)
HAT_PCB = 1.6;
HAT_UNDER = 0.9;                 // tallest part under the HAT (Waveshare STEP model)
BAT = [40, 30, 8];               // 803040, on the pogo-pin side of the HAT
HEADER_TAIL = 3.0;               // solder tails of the male header under the Pi
BOARD_GAP = BAT[2] + HEADER_TAIL + 0.3;   // HAT top face to Pi bottom face (11.3; fitted in the v0.9 print)
PI_PCB = 1.4;
PI_PARTS = 3.2;                  // tall connectors on the Pi top side (mini HDMI, micro USB)
PI_PARTS_LOW = 1.6;              // MEASURE: everything else on the Pi top (the RP3A0 chip, passives)
HEADER_H = 8.5;                  // male header above the Pi PCB (2.5 plastic + 6 pin)
HEADER_CLEAR = 0.6;
HEADER_Z = [9.0, 14.0];          // header band: top long edge (pin 1 at the microSD end)
// mini HDMI and the two micro USB on the bottom long edge (official drawing: centres 12.4 / 41.4 / 54
// from the microSD end), on the top side; they stand past the PCB edge
PI_PORTS = [[12.4, 11.2], [41.4, 8.0], [54.0, 8.0]];   // [centre from the microSD end, width]
PI_PORT_OVERHANG = 0.8;          // MEASURE: how far the connectors stand past the board edge
// Heatsink on the RP3A0 (kept): 12 x 12 x 4, on the chip in the middle of the board. Its position is read
// off the official drawing: centre ~25 from the microSD end, ~16.7 from the header edge.
HEATSINK = [12, 12, 4];          // measured: X x Z x height above the Pi top
HEATSINK_C = [25, 16.7];         // MEASURE: centre, from the microSD end / from the header edge

// ---------- Cavity and walls: the stack sets the width ----------
WALL = 1.6;                      // side walls
WALL_TB = 2.7;                   // top and bottom walls: they hold the snap beams (>= 1.0 of skin over them)
UNDER_HAT = max(SCREW_HEAD_H, HAT_UNDER) + UNDER_CLEAR;
ABOVE_PI = max(HEADER_H, HEX_H, HEATSINK[2]) + HEADER_CLEAR;
CAV_HY = (UNDER_HAT + HAT_PCB + BOARD_GAP + PI_PCB + ABOVE_PI) / 2;   // 12.625
CAV_HZ = 15.9;                   // 30 mm boards + the port overhang + 0.1
CAV_L = 67.2;
LEFT_FACE = -(CAV_HY + WALL);    // head side
RIGHT_FACE = CAV_HY + WALL;      // outer side
OUT_W = 2 * (CAV_HY + WALL);     // 28.45
OUT_H = 2 * (CAV_HZ + WALL_TB);  // 37.2

HAT_BOTTOM_Y = -CAV_HY + UNDER_HAT;
HAT_TOP_Y = HAT_BOTTOM_Y + HAT_PCB;
PI_BOTTOM_Y = HAT_TOP_Y + BOARD_GAP;
PI_TOP_Y = PI_BOTTOM_Y + PI_PCB;
HEADER_TOP_Y = PI_TOP_Y + HEADER_H;
HEX_TIP_Y = PI_TOP_Y + HEX_H;
PAD_MOUTH_Y = HEX_TIP_Y - HEX_ENGAGE;                   // socket mouth, 0.2 above the Pi

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
// Turned 90 degrees from v0.9 so the image matches the wearer's view: the 23.862 side (the one with the
// FPC connector at its end) runs along Y, the 25 side along Z, and the connector edge faces +Y.
// If the picture comes out upside down, it is a 180 degree software flip (libcamera transform).
AI_CAM_W = 25.0;                 // along Z
AI_CAM_H = 23.862;               // along Y; FPC connector on the +Y edge
AI_CAM_PCB_T = 1.12;
AI_CAM_LENS_FROM_TOP = 14.4;     // from the edge opposite the connector; centred across the 25 side
AI_CAM_BARREL_D = 8.0;           // measured: the lens, 1 mm tall, on top of the square holder
AI_CAM_BARREL_REACH = 4.0;       // measured: holder 3 + lens 1, from the PCB front
// The square lens holder between the PCB and the barrel. The v0.9 print showed the drawing's numbers
// fall short (the holder did not fit), so the defaults carry margin.
AI_CAM_HOLDER = [11.0, 3.0];     // measured: side of the square holder, and how far it stands off the PCB front
AI_CAM_CONN_W = 19.61;           // along Z
AI_CAM_CONN_H = 5.71;            // along Y, from the connector edge
AI_CAM_CONN_REACH = 3.8;

CAM_Y0 = -0.4;                   // board centre in Y: leaves 1.4 past the connector edge for the flex
CAM_EDGE_Y = CAM_Y0 + AI_CAM_H / 2;                  // connector edge
LENS_Y = CAM_EDGE_Y - (AI_CAM_H - AI_CAM_LENS_FROM_TOP);
LENS_Z = 0;

// The camera sits as close to the Pi as the flex allows: its connector ends 4.2 mm before the Pi edge,
// room for the flex to step down to the CSI. The nose follows from the front rib (CAM_GUIDE_TO_FRONT).
CAM_BACK_X = -37.5;              // v0.12 test: 1 mm forward, the flex was forced
CAM_FRONT_X = CAM_BACK_X - AI_CAM_PCB_T;
LENS_RECESS = 0.6;               // depth of the chamfer on the outside of the lens hole
CAM_CONN_BACK_X = CAM_BACK_X + AI_CAM_CONN_REACH;
// the board slides in along Y, so the hole must pass the Ø8 lens across the parting plane (LENS_Y off it)
LENS_HOLE_D = 2 * sqrt(pow(AI_CAM_BARREL_D / 2, 2) + pow(LENS_Y, 2)) + 0.4;   // 9.4

CHAMBER_HY = max(CAV_HY, abs(CAM_Y0 - AI_CAM_H / 2) + 0.6);   // 12.93
CHAMBER_HZ0 = 13.4;              // integrated chamber; the power slider is sized from it in both versions
CHAMBER_HZ = CAP ? 14.2 : CHAMBER_HZ0;  // the cap version needs room above and below the board for its ring
CHAMBER_R = 1.5;
// No fine features: the v0.10 print could not reproduce 0.65 ribs and 0.6 crush ribs.
RIB_T = 1.2;                     // three extrusion lines
RIB_GAP = 0.25;                  // board thickness clearance, each side (v0.12 test: 0.15 was too tight)
RIB_OVERLAP = 1.0;               // how far the ribs cover the PCB edge
EDGE_CLEAR = 0.3;                // slot clearance around the board edges
CAM_CORNER_FREE = [7.0, 3.5];    // front rib left open: from the connector edge (Y), from the top edge (Z)
// The v0.11 print: with 2.65 from the front rib's centre to the inside of the front wall, the lens did
// not fit. The user measured what it needs: 5.0.
CAM_GUIDE_TO_FRONT = 5.0;
CHAMBER_FRONT_X = CAM_FRONT_X - RIB_GAP - RIB_T / 2 - CAM_GUIDE_TO_FRONT;
NOSE_WALL = 1.2;                 // the front wall, with the lens hole through it
NOSE_X = CHAMBER_FRONT_X - NOSE_WALL;    // -44.6 (v0.11 print: -42.2)

// ---------- Snap fit: in-plane beams with a hook across the parting plane ----------
// The beam lies along X inside the right-half wall and flexes in Z, so on the print bed (outer
// face down) it bends within the layers, not across them. [hook centre X, hook width, cavity
// half height, side of the root (+1 = root at larger X), beam length, walls (2 = top and bottom)]
// v0.11 print: the front pair sat over the camera ribs, fused to them, so the beam could not flex and
// broke. The hook now sits behind the ribs, where nothing is under it, and the beam runs forward over
// the ribs with a gap under it (snap_reliefs).
SNAPS_ALL = [[-33.0, 3.0, CHAMBER_HZ, -1, 5.0, 2], [-12.0, 5.0, CAV_HZ, -1, 10.0, 2], [18.0, 5.0, CAV_HZ, -1, 10.0, 2],
             [30.0, 4.0, CAV_HZ, -1, 5.0, 2]];   // the rear pair replaces the old pins, which broke
// With a camera cap the front pair would land in the cap, and the cap's strips only hold it in X, not
// the halves together. So that version turns the x -12 pair round, root to the rear, which brings its
// hooks forward to x -22, about 11 mm behind the joint.
SNAPS = CAP ? [[-22.0, 5.0, CAV_HZ, 1, 10.0, 2], for (t = SNAPS_ALL) if (t[0] > 0) t] : SNAPS_ALL;
SNAP_T = 1.2;                    // beam / hook thickness (Z)
SNAP_DEPTH = 2.5;                // beam depth inside the right half (Y)
SNAP_GAP = 0.45;                 // relief above the beam and at its free end
SNAP_BACK_GAP = 0.7;             // relief behind the beam: room for bridge sag so it does not fuse to the wall
SNAP_UNDER_GAP = 0.6;            // room under a nose beam: the hook bump is 0.4
SNAP_WEB = 0.4;                  // breakaway web across the end slot: the beam prints as a bridge; cut it after printing
HOOK_LEN = 3.0;                  // hook reach past the parting plane
BUMP_H = 0.4;
SNAP_CLEAR = 0.05;               // recess roof over the hook: engagement = BUMP_H - SNAP_CLEAR
LIP_T = 1.2;
LIP_CLEAR = 0.2;
LIP_LEN = 2.5;
LIP_SEGMENTS = [[-30.5, -25.0, CAV_HZ], [-8.2, 5.0, CAV_HZ]];
PIN_D = 2.4;
PIN_LEN = 2.6;
PIN_HOLE_D = 2.75;
PINS = [];                       // the rear end is a hollow shell now: the lips align the halves

// ---------- Mode button (one) ----------
BUTTON_X = -14.0;                // off the Pi's heatsink (v0.10 had it right over it)
BUTTON_Z = 2.0;
BUTTON_WALL = 1.4;
BUTTON_HOLE_D = 5.4;
BUTTON_HEAD_D = 5.0;
BUTTON_PROUD = 2.8;              // v0.14: 2 mm longer
BUTTON_FLANGE_T = 0.6;
// 4 x 4 x 1 SMD tact switch (measured); its actuator is under 1 mm, so the printed cap is glued onto it.
// The cap and then the switch go into a pocket open toward the inside of the right half; a printed lid
// (part 06) presses into a step behind the switch and holds it when the button is pushed from outside.
SWITCH_W = 4.0;                  // body, square (measured)
SWITCH_BODY_T = 1.0;             // measured
SWITCH_T = 1.5;                  // MEASURE: body + actuator ("under a millimetre" on top of the body)
SWITCH_ACT_D = 2.0;
SWITCH_LEG_SPAN = 5.8;           // MEASURE: the SMD legs across X
SW_TOP_Y = RIGHT_FACE - BUTTON_WALL - BUTTON_FLANGE_T;     // flange face = actuator tip (glued)
SW_BASE_Y = SW_TOP_Y - SWITCH_T;
POCKET = [6.4, 6.4];             // takes the cap's flange and the switch with its legs
BUTTON_FLANGE = [5.6, 5.6];
LID_T = 1.2;
LID = [POCKET[0] + 1.0, POCKET[1] + 1.0];                 // the lid sits in a step 0.5 wider than the pocket
WIRE_GAP = 1.0;                  // room under the switch for the wires soldered to its legs
LID_BOSS = 3.0;                  // the lid backs the switch body through a boss, clear of the legs
LID_Y = SW_BASE_Y - WIRE_GAP;    // top face of the lid plate (the step)
SLEEVE_T = 1.2;

// ---------- Rear ----------
// The microSD goes in and out through a slot in the rear end (the card end sits ~2 inside: tweezers). The v0.9 print had
// to be cut there, so the rear now leaves the card real room past the Pi edge.
SD_ZC = 1.9;                     // card centre, ~13.1 from the header edge (mirrored from v0.10, which had it on the wrong side)
SD_CARD_OUT = 3.5;               // MEASURE: how far the card sticks out past the Pi edge
SD_CLEAR = 1.0;
CHARGE_PLUG = [11.5, 7.5];       // moulded micro USB plug: Z x Y
CHARGE_CLEAR = 0.5;              // per side: holes print undersize

// ---------- Power slider (HAT switch, head-side face) ----------
// One solid with a common X range, so it prints lying flat on its -X face. With the camera flex now on
// the Pi side, the slider takes the whole space behind the camera: a 9 mm wide knob.
// The window and the knob match the lever itself: its exposed part (x -33.9 .. -29.8) and its travel.
SLIDER_X = [hat_x(-LEVER_TIP) + 0.1, hat_x(SW_BODY_X[0]) - 0.2];   // -33.8 .. -30.0
SLIDER_PLATE_X1 = -28.6;         // the plate runs on past the window, short of the HAT screw heads
SLIDER_KNOB_Z = 3.0;
SLIDER_KNOB_PROUD = 2.5;         // v0.14: 1 mm more, easier to find from outside
SLIDER_PLATE_T = 1.0;
SLIDER_PRONG_T = 1.2;
SLIDER_CLEAR = 0.35;
SLIDER_FIT = 0.1;                // the square pocket around the lever, each side
SLIDER_PRONG_EXTRA = 1.0;        // v0.14: the walls of the pocket reach 1 mm further past the lever
SLIDER_WIN_SIDE = 0.7;           // window past the knob in X, each side (window 5.2 wide)
SLIDER_S = LEVER_TRAVEL / 2;                         // knob stroke each way: the pocket follows the lever
SLIDER_WIN_Z = SLIDER_KNOB_Z + LEVER_TRAVEL + 2 * SLIDER_CLEAR + 0.4;   // the window size that worked (7.4)
SLIDER_TOP = CHAMBER_HZ0 - CHAMBER_R - 0.1;          // where the chamber wall starts to round off (same slider for both versions)
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
// Round transducer (measured 2026-10-26: Ø 14 x 5) in a round cup that opens toward the head, closed
// by a snap-on grille (part 07). The cup's axis is Y; its open face is at CUP_FACE_Y.
TRANSDUCER_D = 14.0;
TRANSDUCER_H = 5.0;
CUP_D = 17.0;                    // v0.16 print: a 15 cup did not take the Ø14 transducer; 2 mm more to test
CUP_DEPTH = 6.0;                 // user: 5.5 to 6 for a 5 mm transducer
CUP_WALL = 2.2;
CUP_OUTER_D = CUP_D + 2 * CUP_WALL;
CUP_LEN = 8.8;                   // along Y: depth + floor
TRANSDUCER_CENTER = [69.0, -22.0 + ARM_DY - 1.0, -16.0];
CUP_FACE_Y = TRANSDUCER_CENTER[1] - CUP_LEN / 2;
// grille snap: a skirt of fingers over the cup rim, with a bead that drops into a groove on the cup
GRILLE_T = 1.2;
GRILLE_SKIRT_T = 0.8;
GRILLE_SKIRT_L = 3.1;            // from the rim along the cup; ends inside the groove band
GRILLE_CLEAR = 0.2;
GRILLE_BEAD = 0.3;               // bead height; the groove is 0.45 deep
GRILLE_GROOVE_Y = [2.2, 3.2];    // groove band, from the rim
GRILLE_GAP_ANGLE = 70;           // no skirt where the arm tube joins the cup (the -X side)
EAR_SLOT = [1.6, 8.0];           // slot in the cover, across (X) and along (Z)
EAR_SLOT_X = 4.6;                // slot centre from the cup axis, toward the ear (+X)

// Outer shape: X, total Y width, total Z height, corner radius. Flat sides between -47 and 30.
NOSE_H = 2 * (CHAMBER_HZ + WALL_TB);   // 32.2 (33.8 with the camera cap): the chamber plus the walls that hold the front snaps
stations = [
    [NOSE_X, OUT_W - 1.2, NOSE_H - 1.6, 4.6],
    [NOSE_X + 2.7, OUT_W, NOSE_H, 5.0],
    [-37.0, OUT_W, NOSE_H, 5.2],
    [-31.0, OUT_W, OUT_H - 0.4, 6.0],
    [-24.0, OUT_W, OUT_H, 6.2],
    [ 30.0, OUT_W, OUT_H, 6.2],
    [ 35.0, OUT_W - 0.2, OUT_H, 6.0],          // full height over the rear snaps
    [ 37.6, OUT_W - 0.8, OUT_H - 2.4, 5.8],
    [ 39.6, OUT_W - 2.8, OUT_H - 7.0, 5.4],
    [ 41.2, OUT_W - 6.8, OUT_H - 12.6, 4.8]
];
// The shell is hollow end to end: the same stations shrunk by the walls (1.6 at the sides, 2.4 top and
// bottom) up to 1.6 before the rear face. In the middle this is exactly the cavity;
// at the rear it empties what used to be a solid block.
inner_stations = [for (st = stations) if (st[0] >= CHAMBER_FRONT_X - 0.01 && st[0] <= 39.6)
                     [st[0], st[1] - 2 * WALL, st[2] - 2 * WALL_TB, max(st[3] - WALL, 1.0)]];

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

// grow: the camera ribs are cut with a slightly larger chamber, so they overlap the walls and fuse with them
module chamber(grow = 0) {
    translate([(CHAMBER_FRONT_X + STACK_FRONT_X + 1) / 2, 0, 0])
        rounded_prism_x(STACK_FRONT_X + 1 - CHAMBER_FRONT_X, 2 * (CHAMBER_HY + grow), 2 * (CHAMBER_HZ + grow), CHAMBER_R + grow);
}
module cavity() {
    translate([PI_CX, 0, 0]) rounded_prism_x(CAV_L, 2 * CAV_HY, 2 * CAV_HZ, 2.5);
    chamber();
    // the hollow shell from the Pi back (in the nose the chamber already is the hollow)
    intersection() { loft(inner_stations); box([STACK_FRONT_X, -50, -50], [50, 50, 50]); }
    // microSD: room past the Pi's rear edge for the card at the Pi level
    box([STACK_REAR_X - 1, PI_BOTTOM_Y - 0.3, SD_ZC - 7.5], [STACK_REAR_X + SD_CARD_OUT + SD_CLEAR, PI_TOP_Y + 3.0, SD_ZC + 7.5]);
}

module lens_opening() {
    translate([NOSE_X - 2, LENS_Y, LENS_Z]) rotate([0, 90, 0]) cylinder(h = CHAMBER_FRONT_X - NOSE_X + 2.1, d = LENS_HOLE_D);
    // chamfer: the 66 x 52 degree field of view clears the face
    translate([NOSE_X - 0.01, LENS_Y, LENS_Z]) rotate([0, 90, 0]) cylinder(h = LENS_RECESS + 0.02, d1 = LENS_HOLE_D + 2 * LENS_RECESS * 1.2, d2 = LENS_HOLE_D);
}

module rear_openings() {
    // microSD: the card's space opens through the rear end, so the card goes in and out with the case closed
    box([STACK_REAR_X, PI_TOP_Y - 0.6, SD_ZC - 6.5], [50, PI_TOP_Y + 2.4, SD_ZC + 6.5]);
    // charging micro USB of the HAT: straight channel for the moulded plug
    translate([STACK_REAR_X + 5, HAT_TOP_Y + USB_H / 2, (USB_Z[0] + USB_Z[1]) / 2]) rounded_box3d([12, CHARGE_PLUG[1] + 2 * CHARGE_CLEAR, CHARGE_PLUG[0] + 2 * CHARGE_CLEAR], 1.5);
}

// ---------- Camera slot: ribs in front of and behind the PCB, stops on its four edges ----------
module camera_frame() {
    front0 = CAM_FRONT_X - RIB_GAP - RIB_T;
    back1 = CAM_BACK_X + RIB_GAP + RIB_T;
    hy = AI_CAM_H / 2;
    hz = AI_CAM_W / 2;
    intersection() {
        chamber(0.2);
        difference() {
            box([front0, -50, -50], [back1, 50, 50]);
            // the board itself, with clearance on the thickness and on the four edges
            box([CAM_FRONT_X - RIB_GAP, CAM_Y0 - hy - EDGE_CLEAR, -hz - EDGE_CLEAR],
                [CAM_BACK_X + RIB_GAP, CAM_Y0 + hy + EDGE_CLEAR, hz + EDGE_CLEAR]);
            // open window: optics in front, parts behind
            box([front0 - 1, CAM_Y0 - hy + RIB_OVERLAP, -hz + RIB_OVERLAP], [back1 + 1, CAM_Y0 + hy - RIB_OVERLAP, hz - RIB_OVERLAP]);
            // the FPC connector and the flex leave the back of the board at the +Y edge
            box([CAM_BACK_X, CAM_EDGE_Y - AI_CAM_CONN_H - 0.5, -AI_CAM_CONN_W / 2 - 0.6], [back1 + 1, 50, AI_CAM_CONN_W / 2 + 0.6]);
            // v0.12 test: a small part on the lens side, in the corner of the connector edge and the top
            // edge, hit the front rib; that corner of the rib is open so the board slides in freely
            box([front0 - 1, CAM_EDGE_Y - CAM_CORNER_FREE[0], hz - CAM_CORNER_FREE[1]], [CAM_FRONT_X, 50, 50]);
        }
    }
}

// The camera flex leaves the connector at the +Y edge, folds back along the outer wall, then steps down
// to the Pi CSI (Pi top side, front edge) and goes in flat. Nothing solid may enter this volume.
module flex_keepout() {
    fz = AI_CAM_CONN_W / 2 - 1;
    box([CAM_BACK_X + 0.2, CAM_EDGE_Y, -fz], [CAM_CONN_BACK_X + 1, CHAMBER_HY - 0.1, fz]);
    box([CAM_BACK_X + 0.2, PI_TOP_Y - 0.5, -fz], [STACK_FRONT_X, CHAMBER_HY - 0.1, fz]);
}

// ---------- Pads (right half): the hex standoffs above the Pi seat here ----------
module pad_solid() { translate([0, PAD_MOUTH_Y, 0]) rotate([-90, 0, 0]) cylinder(h = CAV_HY + 0.5 - PAD_MOUTH_Y, d = PAD_D, $fn = 48); }
// the four posts, cut back 0.3 from the header and the ports (in the model frame)
module pads() { difference() { pad_positions() pad_solid(); pi_tall_parts(0.3); } }
// a flat faces the header and the ports, where the post is cut back: 0.8 of wall there
// (turn the standoffs to match when fitting the stack)
module pad_socket() { translate([0, PAD_MOUTH_Y - 0.01, 0]) hex_y(SOCKET_AF, SOCKET_DEPTH); }
module pad_positions() { for (dx = [-PI_HOLE_X, PI_HOLE_X], z = [-PI_HOLE_Z, PI_HOLE_Z]) translate([PI_CX + dx, 0, z]) children(); }

// ---------- Power slider: a knob on the head-side face drives the HAT switch lever ----------
// v0.20: a panel slide switch, wired to the HAT, replaces the printed slider. Its knob comes out of the window
// the slider had (same length, 1 mm narrower) and its flange sits on the inner face of the wall, its two screw
// holes on the pins; glue holds it. Centred 2 mm lower than the slider window: a flange ~20 long centred there
// would reach the rounded top corner of the chamber.
PANEL_SW_DROP = 2.0;
PANEL_SW_C = [(SLIDER_X[0] + SLIDER_X[1]) / 2, SLIDER_KNOB_C - PANEL_SW_DROP];    // window centre: x, z
// a raised dot below the window marks the bottom end of the stroke
module slider_on_dot() {
    translate([PANEL_SW_C[0], LEFT_FACE + 0.3, PANEL_SW_C[1] - PANEL_SW_WIN[1] / 2 - 1.6]) rotate([90, 0, 0]) cylinder(h = 0.9, d1 = 1.8, d2 = 1.2, $fn = 24);
}
module panel_switch_window() {
    box([PANEL_SW_C[0] - PANEL_SW_WIN[0] / 2, LEFT_FACE - 1, PANEL_SW_C[1] - PANEL_SW_WIN[1] / 2],
        [PANEL_SW_C[0] + PANEL_SW_WIN[0] / 2, -CHAMBER_HY + 0.01, PANEL_SW_C[1] + PANEL_SW_WIN[1] / 2]);
}
// one pin standing on a face at the origin, toward +Z (the test plate) ...
module panel_switch_pin() {
    cylinder(h = PANEL_SW_PIN_L - 0.4, d = PANEL_SW_PIN_D);
    translate([0, 0, PANEL_SW_PIN_L - 0.41]) cylinder(h = 0.41, d1 = PANEL_SW_PIN_D, d2 = PANEL_SW_PIN_D - 0.8);
}
// ... and both in the case, on the inner face of the wall toward +Y (rooted 0.4 into the wall)
module panel_switch_pins() {
    for (sz = [-1, 1]) translate([PANEL_SW_C[0], -CHAMBER_HY, PANEL_SW_C[1] + sz * PANEL_SW_PITCH / 2]) rotate([-90, 0, 0]) {
        translate([0, 0, -0.4]) cylinder(h = 0.41, d = PANEL_SW_PIN_D);
        panel_switch_pin();
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
        // lead-in ramp toward the tip (~22 deg), 45 deg retention face toward the root
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
        // in the nose the camera ribs reach the chamber roof: clear them under the beam so it can flex
        if (hz < CAV_HZ) box([min(e, r), -0.01, hz - SNAP_UNDER_GAP], [max(e, r), SNAP_DEPTH + SNAP_BACK_GAP, hz + 0.01]);
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
    for (p = PINS) translate([p[0], 0.01, p[1]]) rotate([90, 0, 0]) {
        cylinder(h = PIN_LEN - 0.5, d = PIN_D);
        translate([0, 0, PIN_LEN - 0.51]) cylinder(h = 0.5, d1 = PIN_D, d2 = PIN_D - 0.8);
    }
}
module lip_recesses_left() {
    for (s = LIP_SEGMENTS) both_walls() box([s[0] - 0.3, -LIP_LEN - 0.3, s[2] - 0.01], [s[1] + 0.3, 0.01, s[2] + LIP_T + LIP_CLEAR]);
    for (p = PINS) translate([p[0], 0.01, p[1]]) rotate([90, 0, 0]) cylinder(h = PIN_LEN + 0.4, d = PIN_HOLE_D);
    translate([40.5, 0, -4]) rounded_box3d([6, 1.6, 5], 0.4);   // pry notch at the rear seam, clear of the pins
}

// ---------- Button pocket (right half) ----------
// A sleeve around a pocket open toward the cavity: the cap goes in first (head through its hole, flange
// against the wall), then the switch, then the lid, which stops on the step and backs the switch.
module switch_drawer_solid() {
    box([BUTTON_X - LID[0] / 2 - SLEEVE_T, LID_Y - LID_T, BUTTON_Z - LID[1] / 2 - SLEEVE_T],
        [BUTTON_X + LID[0] / 2 + SLEEVE_T, CAV_HY + 0.5, BUTTON_Z + LID[1] / 2 + SLEEVE_T]);
}
module switch_drawer_cut() {
    box([BUTTON_X - POCKET[0] / 2, LID_Y - 0.01, BUTTON_Z - POCKET[1] / 2], [BUTTON_X + POCKET[0] / 2, SW_TOP_Y + BUTTON_FLANGE_T + 0.05, BUTTON_Z + POCKET[1] / 2]);
    // the lid step: 0.15 per side (FDM prints holes small and plates big); a drop of glue holds the lid
    box([BUTTON_X - LID[0] / 2 - 0.15, LID_Y - LID_T - 1, BUTTON_Z - LID[1] / 2 - 0.15], [BUTTON_X + LID[0] / 2 + 0.15, LID_Y, BUTTON_Z + LID[1] / 2 + 0.15]);
    translate([BUTTON_X, SW_TOP_Y, BUTTON_Z]) rotate([-90, 0, 0]) cylinder(h = 10, d = BUTTON_HOLE_D);
    // finder ring around the button, to locate it by touch
    translate([BUTTON_X, RIGHT_FACE - 0.6, BUTTON_Z]) rotate([-90, 0, 0])
        difference() { cylinder(h = 2, d = 11.6); cylinder(h = 5, d = 9.0, center = true); }
}

// ---------- Camera cap (VARIANT "cap") ----------
CAP_X = CAM_BACK_X + 0.4;        // the joint: the whole camera board is in the cap
CAP_RING_L = 2.4;                // the ring goes this far into the body
CAP_BEAD = 0.3;                  // the bead on the ring, trapped by a groove in both halves
CAM_HOLE_D = 2.2;                // the camera's mounting holes (product brief)
CAM_PIN_D = 1.9;
CAM_POST_D = 3.6;
// mounting holes: 2.0 from the sides of the 25 side (Z), rows 2.0 and 14.5 from the edge opposite the connector (Y)
CAM_HOLES = [for (z = [-AI_CAM_W / 2 + 2.0, AI_CAM_W / 2 - 2.0], d = [2.0, 14.5]) [CAM_EDGE_Y - AI_CAM_H + d, z]];
module cap_region() { box([-80, -50, -50], [CAP_X, 50, 50]); }
module body_region() { box([CAP_X, -50, -50], [80, 50, 50]); }
// the ring is two strips, above and below the board: the board has to pass between them to reach its posts
CAP_STRIP_Z = AI_CAM_W / 2 + 0.2;     // inner face of the strips, clear of the board edges
module cap_ring() {
    intersection() {
        union() {
            intersection() { chamber(-0.05); box([CAP_X - 0.01, -50, -50], [CAP_X + CAP_RING_L, 50, 50]); }
            // root: the strips run 1 mm back into the cap's own wall, so they are one piece with it
            intersection() { chamber(0.3); box([CAP_X - 1.0, -50, -50], [CAP_X, 50, 50]); }
            intersection() { chamber(CAP_BEAD - 0.05); box([CAP_X + 1.1, -50, -50], [CAP_X + 1.9, 50, 50]); }
        }
        union() { for (sz = [-1, 1]) box([CAP_X - 1, -50, sz * CAP_STRIP_Z], [CAP_X + CAP_RING_L + 1, 50, sz * 50]); }
    }
}
module cap_groove() {
    intersection() {
        difference() {
            intersection() { chamber(CAP_BEAD); box([CAP_X + 1.0, -50, -50], [CAP_X + 2.0, 50, 50]); }
            chamber(-1);
        }
        union() { for (sz = [-1, 1]) box([CAP_X, -50, sz * CAP_STRIP_Z], [CAP_X + 2.6, 50, sz * 50]); }
    }
}
module cam_posts() {
    for (h = CAM_HOLES) {
        translate([CHAMBER_FRONT_X - 0.5, h[0], h[1]]) rotate([0, 90, 0]) cylinder(h = CAM_FRONT_X - CHAMBER_FRONT_X + 0.5, d = CAM_POST_D);
        translate([CAM_FRONT_X - 0.01, h[0], h[1]]) rotate([0, 90, 0]) cylinder(h = AI_CAM_PCB_T - 0.1, d = CAM_PIN_D);
    }
}
module camera_cap() {
    difference() {
        union() {
            intersection() { difference() { outer_shell(); cavity(); } cap_region(); }
            cam_posts();
            cap_ring();
        }
        lens_opening();
    }
}

// ---------- Halves ----------
module left_body() {
    if (CAP) difference() { intersection() { left_body_full(); body_region(); } cap_groove(); }
    else left_body_full();
}
module right_body() {
    if (CAP) difference() { intersection() { right_body_full(); body_region(); } cap_groove(); }
    else right_body_full();
}
module left_body_full() {
    difference() {
        union() {
            intersection() { difference() { outer_shell(); cavity(); } half_space(-1); }
            if (!CAP) intersection() { camera_frame(); half_space(-1); }
            elastic_bridges();
            bone_socket_boss();
            slider_on_dot();
            panel_switch_pins();
        }
        lens_opening();
        rear_openings();
        panel_switch_window();
        snap_recesses();
        lip_recesses_left();
        bone_socket_cut();
        bone_cable_port();
    }
}

module right_body_full() {
    difference() {
        union() {
            intersection() { difference() { outer_shell(); cavity(); } half_space(1); }
            if (!CAP) intersection() { camera_frame(); half_space(1); }
            pads();
            switch_drawer_solid();
            snap_hooks();
            lips_right();
        }
        pad_positions() pad_socket();
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
    // v0.14: just a cylinder glued onto the switch actuator (no inner flange), with a chamfered tip
    l = BUTTON_FLANGE_T + BUTTON_WALL + BUTTON_PROUD;
    rotate([-90, 0, 0]) {
        cylinder(h = l - 0.4, d = BUTTON_HEAD_D, $fn = 40);
        translate([0, 0, l - 0.41]) cylinder(h = 0.41, d1 = BUTTON_HEAD_D, d2 = BUTTON_HEAD_D - 0.8, $fn = 40);
    }
}
module button_cap_placed() { translate([BUTTON_X, SW_TOP_Y, BUTTON_Z]) button_cap(); }
// lid (part 06): a press fit in the step behind the switch, glued; its centre boss backs the switch body,
// the gap around it holds the soldered wires, and two notches at the leg sides let them out
module button_lid() {
    difference() {
        union() {
            translate([-LID[0] / 2, -LID_T, -LID[1] / 2]) cube([LID[0], LID_T, LID[1]]);
            translate([-LID_BOSS / 2, -0.01, -LID_BOSS / 2]) cube([LID_BOSS, WIRE_GAP + 0.01, LID_BOSS]);
        }
        for (sx = [-1, 1]) translate([sx * (LID[0] / 2 - 0.7), -LID_T / 2, 0]) cube([1.6, LID_T + 1, 2.4], center = true);
    }
}
module button_lid_placed() { translate([BUTTON_X, LID_Y, BUTTON_Z]) button_lid(); }

// ---------- Bone arm (v0.8 geometry, moved with the head-side face, 14 mm pocket) ----------
// The tube starts 0.4 clear of the socket boss (v0.10 had it 0.6 into the boss, so the arm did not seat)
ARM_OUT = -1.0;
arm_pts = [for (p = [[29, -18, -.5], [36.5, -18.2, -.8], [44, -19, -2.5], [52, -20.1, -6.1], [59, -21.2, -10.8], [64, -22, -14.9]]) p + [0, ARM_DY + ARM_OUT, 0]];
module bone_outer() { for (i = [0 : len(arm_pts) - 2]) capsule(arm_pts[i], arm_pts[i + 1], 2.7); }
module bone_tunnel() {
    p0 = [29, -12.8 + ARM_DY, -.5]; pN = [66.2, -22 + ARM_DY + ARM_OUT, -15.4];
    capsule(p0, arm_pts[0], 1.3);
    for (i = [0 : len(arm_pts) - 2]) capsule(arm_pts[i], arm_pts[i + 1], 1.3);
    capsule(arm_pts[len(arm_pts) - 1], pN, 1.3);
}
// plug: 0.35 clearance per side in the socket, no detent bumps (they jammed: the socket has no dimples);
// it reaches out to the tube. Push it in and fix it with a drop of glue if it is loose.
module bone_plug() {
    translate([29, -15.4 + ARM_DY, -.5]) rounded_box3d([8.5, 6.5, 10.6], 1);   // reaches 0.3 short of the socket floor
    hull() {
        translate([29, -18.2 + ARM_DY, -.5]) cube([8.5, 0.1, 6.0], center = true);
        translate(arm_pts[0]) sphere(r = 2.7, $fn = 28);
    }
}
// cup frame: origin on the cup axis at the open face, +Z along the cup into it (= +Y in the model)
module at_cup() { translate([TRANSDUCER_CENTER[0], CUP_FACE_Y, TRANSDUCER_CENTER[2]]) rotate([-90, 0, 0]) children(); }
// the side the arm tube comes from, in the cup frame (model -X stays -X)
module transducer_cradle() { at_cup() cylinder(h = CUP_LEN, d = CUP_OUTER_D, $fn = 72); }
module transducer_pocket() {
    at_cup() translate([0, 0, -0.01]) cylinder(h = CUP_DEPTH + 0.01, d = CUP_D, $fn = 72);
    // the groove the grille bead drops into: square bottom, 45 degree flank toward the rim for the print
    at_cup() rotate_extrude($fn = 72) polygon([
        [CUP_OUTER_D / 2 + 1, GRILLE_GROOVE_Y[0] - 0.45], [CUP_OUTER_D / 2 - 0.45, GRILLE_GROOVE_Y[0]],
        [CUP_OUTER_D / 2 - 0.45, GRILLE_GROOVE_Y[1]], [CUP_OUTER_D / 2 + 1, GRILLE_GROOVE_Y[1]]]);
}
// Cover (part 07): a solid disc on the cup rim with a slot toward the ear; six fingers reach over the rim
// and click into the groove
module grille() {
    r_in = CUP_OUTER_D / 2 + GRILLE_CLEAR;
    difference() {
        union() {
            translate([0, 0, -GRILLE_T]) cylinder(h = GRILLE_T, r = r_in + GRILLE_SKIRT_T, $fn = 72);
            // the skirt; at its tip the bead: a lead-in ramp at the tip, a square retention face behind it
            rotate_extrude($fn = 72) polygon([
                [r_in, 0], [r_in + GRILLE_SKIRT_T, 0], [r_in + GRILLE_SKIRT_T, GRILLE_SKIRT_L], [r_in, GRILLE_SKIRT_L],
                [r_in - GRILLE_BEAD - GRILLE_CLEAR, GRILLE_SKIRT_L - 0.5],
                [r_in - GRILLE_BEAD - GRILLE_CLEAR, GRILLE_GROOVE_Y[0] + 0.05], [r_in, GRILLE_GROOVE_Y[0] + 0.05]]);
        }
        // solid, like a bone-conduction earpiece, with one slot on the side toward the ear (+X, behind)
        translate([EAR_SLOT_X - EAR_SLOT[0] / 2, -EAR_SLOT[1] / 2, -GRILLE_T - 1]) cube([EAR_SLOT[0], EAR_SLOT[1], GRILLE_T + 1.5]);
        // six fingers: slots through the skirt, and none on the side of the arm tube
        for (a = [0 : 60 : 359]) rotate([0, 0, a + 30]) translate([r_in - 1, -0.6, 0.6]) cube([3, 1.2, GRILLE_SKIRT_L + 1]);
        rotate([0, 0, 180]) linear_extrude(height = GRILLE_SKIRT_L + 1) polygon([[0, 0],
            [20 * cos(GRILLE_GAP_ANGLE / 2), 20 * sin(GRILLE_GAP_ANGLE / 2)], [20 * cos(GRILLE_GAP_ANGLE / 2), -20 * sin(GRILLE_GAP_ANGLE / 2)]]);
    }
}
module grille_placed() { at_cup() grille(); }
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
        translate([64.6, -22 + ARM_DY + ARM_OUT, -15.4]) rotate([0, 90, 0]) cylinder(h = 7.4, d = 2.8);
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
module hw_screw_heads() { pad_positions() translate([0, HAT_BOTTOM_Y - SCREW_HEAD_H, 0]) rotate([-90, 0, 0]) cylinder(h = SCREW_HEAD_H, d = SCREW_HEAD_D); }
module hw_heatsink() {
    translate([STACK_REAR_X - HEATSINK_C[0] - HEATSINK[0] / 2, PI_TOP_Y, PI_W / 2 - HEATSINK_C[1] - HEATSINK[1] / 2]) cube([HEATSINK[0], HEATSINK[2], HEATSINK[1]]);
}
module hex_holed() { difference() { hex_y(HEX_AF, HEX_H); translate([0, HEX_H - 1.1, 0]) rotate([-90, 0, 0]) cylinder(h = 1.2, d = HEX_HOLE_D, $fn = 24); } }
module hw_hex() { pad_positions() translate([0, PI_TOP_Y, 0]) hex_holed(); }
// male header above the Pi, and the ports on its lower long edge; grow = clearance around them
module pi_tall_parts(grow = 0) {
    box([STACK_REAR_X - 57.9 - grow, PI_TOP_Y - 1, HEADER_Z[0] - grow], [STACK_REAR_X - 7.1 + grow, HEADER_TOP_Y + grow, HEADER_Z[1] + grow]);
    for (p = PI_PORTS) box([STACK_REAR_X - p[0] - p[1] / 2 - grow, PI_TOP_Y - 1, -PI_W / 2 - PI_PORT_OVERHANG - grow], [STACK_REAR_X - p[0] + p[1] / 2 + grow, PI_TOP_Y + PI_PARTS + grow, -PI_W / 2 + 5 + grow]);
}
module hw_pi() {
    box([STACK_FRONT_X, PI_BOTTOM_Y, -PI_W / 2], [STACK_REAR_X, PI_TOP_Y, PI_W / 2]);
    // low parts over the board. The Pi's drawing keeps a Ø6 ring free around each hole; the hex-socket posts
    // are wider (Ø8.2), so this assumes nothing low within their footprint (to check on the real board)
    difference() {
        box([STACK_FRONT_X, PI_TOP_Y, -PI_W / 2], [STACK_REAR_X, PI_TOP_Y + PI_PARTS_LOW, HEADER_Z[0]]);
        pad_positions() translate([0, PI_TOP_Y - 1, 0]) rotate([-90, 0, 0]) cylinder(h = PI_PARTS_LOW + 2, d = PAD_D + 0.4);
    }
    pi_tall_parts();
    box([STACK_REAR_X - 57.9, PI_BOTTOM_Y - HEADER_TAIL, HEADER_Z[0]], [STACK_REAR_X - 7.1, PI_BOTTOM_Y, HEADER_Z[1]]);
    // microSD card sticking out of the rear edge
    box([STACK_REAR_X - 4, PI_TOP_Y + 0.2, SD_ZC - 5.5], [STACK_REAR_X + SD_CARD_OUT, PI_TOP_Y + 1.2, SD_ZC + 5.5]);
    // standoffs between the boards
    pad_positions() translate([0, HAT_TOP_Y, 0]) hex_y(5.0, BOARD_GAP);
}
module hw_camera(squeeze = 0) {
    hy = AI_CAM_H / 2;
    difference() {
        box([CAM_FRONT_X, CAM_Y0 - hy, -AI_CAM_W / 2 + squeeze], [CAM_BACK_X, CAM_Y0 + hy, AI_CAM_W / 2 - squeeze]);
        for (h = CAM_HOLES) translate([CAM_FRONT_X - 1, h[0], h[1]]) rotate([0, 90, 0]) cylinder(h = 4, d = CAM_HOLE_D);
    }
    translate([CAM_FRONT_X - AI_CAM_HOLDER[1], LENS_Y - AI_CAM_HOLDER[0] / 2, LENS_Z - AI_CAM_HOLDER[0] / 2]) cube([AI_CAM_HOLDER[1], AI_CAM_HOLDER[0], AI_CAM_HOLDER[0]]);
    translate([CAM_FRONT_X, LENS_Y, LENS_Z]) rotate([0, -90, 0]) cylinder(h = AI_CAM_BARREL_REACH, d = AI_CAM_BARREL_D);
    box([CAM_BACK_X, CAM_EDGE_Y - AI_CAM_CONN_H, -AI_CAM_CONN_W / 2], [CAM_CONN_BACK_X, CAM_EDGE_Y, AI_CAM_CONN_W / 2]);
}
module hw_switch() {
    box([BUTTON_X - SWITCH_W / 2, SW_BASE_Y, BUTTON_Z - SWITCH_W / 2], [BUTTON_X + SWITCH_W / 2, SW_BASE_Y + SWITCH_BODY_T, BUTTON_Z + SWITCH_W / 2]);
    translate([BUTTON_X, SW_BASE_Y + SWITCH_BODY_T - 0.01, BUTTON_Z]) rotate([-90, 0, 0]) cylinder(h = SWITCH_T - SWITCH_BODY_T + 0.01, d = SWITCH_ACT_D);
    // SMD legs on the X sides, flush with the base
    box([BUTTON_X - SWITCH_LEG_SPAN / 2, SW_BASE_Y, BUTTON_Z - 1.6], [BUTTON_X + SWITCH_LEG_SPAN / 2, SW_BASE_Y + 0.4, BUTTON_Z + 1.6]);
}
module hw_transducer() { at_cup() translate([0, 0, CUP_DEPTH - TRANSDUCER_H - 0.3]) cylinder(h = TRANSDUCER_H, d = TRANSDUCER_D, $fn = 48); }
module hardware() {
    color([.15, .35, .8]) hw_hat();
    color("red") hw_lever();
    color("silver") hw_screw_heads();
    color("goldenrod") hw_hex();
    color("silver") hw_heatsink();
    color([.1, .55, .2]) hw_pi();
    color([.2, .2, .25]) hw_camera();
    color("white") hw_switch();
    color("orange") hw_transducer();
}
module hw_all() { hw_hat(); hw_lever(); hw_pi(); hw_camera(); hw_switch(); hw_screw_heads(); hw_heatsink(); }

module assembly() {
    color("#2c2c2c") translate([0, -EXPLODE, 0]) left_body();
    color("#4a4a4a", 0.55) translate([0, EXPLODE, 0]) right_body();
    color("#d9d9d9") translate([0, EXPLODE, 0]) button_cap_placed();
    color("#bdbdbd") translate([0, -EXPLODE, 0]) grille_placed();
    if (CAP) color("#3a3a3a") translate([-EXPLODE, 0, 0]) camera_cap();
    color("#1b1b1b") translate([0, -EXPLODE, 0]) bone_arm();
    if (SHOW_HW) hardware();
}

// ---------- Print orientation ----------
// left half: rests on the flat tops of the arm boss and the elastic bridges (3.8 proud of the
// head-side face), with supports under the face; right half: on its flat outer face
module print_left() { translate([0, 0, -LEFT_FACE + 3.8]) rotate([90, 0, 0]) left_body(); }
module print_right() { translate([0, 0, RIGHT_FACE]) rotate([-90, 0, 0]) right_body(); }
// Test print: only the nose of each half, cut in front of the stack, to try the camera before the whole case
NOSE_TEST_CUT_X = -28.0;
module nose_test_cut() { box([-100, -50, -50], [NOSE_TEST_CUT_X, 50, 50]); }
// Test print for the panel slide switch that replaces the HAT's switch (2026-10-29): a plate as thick as the
// head-side wall with the 4.2 wide window, and two pins for the flange's screw holes on the inside. The v0.18
// coupon tried 13.0..14.0; 14.0 was the closest and still 0.5 short. Glue holds it.
PANEL_SW_WIN = [4.2, 7.4];        // window across (X in the case) and along the travel (Z)
PANEL_SW_PITCH = 14.8;            // v0.18 test: 14.0 + 0.5; v0.19 tests: 14.5, 14.7, then 14.8
PANEL_SW_PIN_D = 2.3;             // v0.18 test: 1.5 too thin; v0.19 tests: 3.0, 2.9, 2.7, then 2.3
PANEL_SW_PIN_L = 2.0;
module print_panel_switch_test() {
    wall = -LEFT_FACE - CHAMBER_HY;          // the head-side wall where the window goes (1.3)
    size = [10, 26];
    difference() {
        cube([size[0], size[1], wall]);
        translate([size[0] / 2 - PANEL_SW_WIN[0] / 2, size[1] / 2 - PANEL_SW_WIN[1] / 2, -1])
            cube([PANEL_SW_WIN[0], PANEL_SW_WIN[1], wall + 2]);
    }
    for (sy = [-1, 1]) translate([size[0] / 2, size[1] / 2 + sy * PANEL_SW_PITCH / 2, wall - 0.01]) panel_switch_pin();
}

// Test print: hex sockets from 3.0 to 5.5 across flats, 1.5 deep, to find the one the standoff above the
// Pi drops into (v0.12 test: 2.2 was not it). Socket n (1..6) has n dots in front of it.
HEX_TEST_AF = [3.0, 3.5, 4.0, 4.5, 5.0, 5.5];
module print_hex_sizes() {
    pitch = 10;
    difference() {
        union() {
            translate([0, -5, 0]) cube([pitch * len(HEX_TEST_AF), 15, 1.2]);
            for (i = [0 : len(HEX_TEST_AF) - 1]) translate([i * pitch + pitch / 2, 0, 0])
                cylinder(h = 4, d = HEX_TEST_AF[i] * 2 / sqrt(3) + 2.4, $fn = 48);
        }
        for (i = [0 : len(HEX_TEST_AF) - 1]) translate([i * pitch + pitch / 2, 0, 4 - 1.5])
            rotate([0, 0, 30]) cylinder(h = 2, r = HEX_TEST_AF[i] / sqrt(3), $fn = 6);
    }
    for (i = [0 : len(HEX_TEST_AF) - 1], j = [0 : i]) translate([i * pitch + pitch / 2 + (j - i / 2) * 1.5, 7, 0.8])
        cylinder(h = 1.0, d = 1.0, $fn = 16);
}

// Test print: the outer wall under the Pi with its four posts, to try the stack in the sockets
module print_pads_test() {
    translate([0, 0, RIGHT_FACE]) rotate([-90, 0, 0]) intersection() {
        right_body();
        union() {
            box([PI_CX - PI_HOLE_X - 4, RIGHT_FACE - WALL - 0.01, -PI_HOLE_Z - 4], [PI_CX + PI_HOLE_X + 4, RIGHT_FACE + 1, PI_HOLE_Z + 4]);
            pad_positions() translate([0, PAD_MOUTH_Y - 0.5, 0]) rotate([-90, 0, 0]) cylinder(h = 30, d = PAD_D + 0.02);
        }
    }
}
// the head-side face lies flat on the bed; the raised ON dot under the slider window is cut off
module print_nose_left() {
    intersection() {
        translate([0, 0, -LEFT_FACE]) rotate([90, 0, 0]) intersection() { left_body(); nose_test_cut(); }
        box([-100, -100, 0], [100, 100, 100]);
    }
}
module print_nose_right() { translate([0, 0, RIGHT_FACE]) rotate([-90, 0, 0]) intersection() { right_body(); nose_test_cut(); } }
module print_button() { rotate([90, 0, 0]) button_cap(); }
module print_grille() { translate([0, 0, GRILLE_T]) grille(); }   // cover: disc down, fingers up
// the cap stands on its front face
module print_cap() { translate([0, 0, -NOSE_X + 0.15]) rotate([0, -90, 0]) camera_cap(); }   // the loft's end slice reaches 0.15 past NOSE_X
// lying down; the offset is the measured lowest point of the rotated arm (export.sh checks that
// every print part sits on the bed, so a change that moves the arm fails loudly)
BONE_PRINT_Z = ARM_DY - 13.76 + 1.601;   // follows the arm when the head-side face moves
module print_bone() { translate([0, 0, BONE_PRINT_Z]) rotate([-90, 0, 0]) bone_arm(); }

// ---------- Interference checks: every one of these must render EMPTY (or zero-volume contact) ----------
module check(name) {
    if (name == "halves") intersection() { left_body(); right_body(); }
    else if (name == "left_hw") intersection() { left_body(); union() { hw_all(); hw_hex(); } }
    else if (name == "right_hw") intersection() { right_body(); hw_all(); }
    else if (name == "pads_hex") intersection() { right_body(); hw_hex(); }
    else if (name == "button") intersection() { button_cap_placed(); union() { left_body(); right_body(); hw_switch(); hw_pi(); } }
    else if (name == "panel_switch") intersection() { panel_switch_pins(); union() { right_body(); hw_all(); hw_hex(); flex_keepout(); } }
    else if (name == "flex") intersection() { flex_keepout(); union() { left_body(); right_body(); hw_hat(); hw_hex(); } }
    else if (name == "hw_self") intersection() { hw_hat(); hw_pi(); }
    else if (name == "bone") intersection() { bone_arm(); union() { left_body(); hw_transducer(); } }
    else if (name == "drawer_pi") intersection() { union() { switch_drawer_solid(); hw_switch(); } union() { hw_pi(); hw_hex(); hw_heatsink(); } }
    // assembly paths, not just the final positions. The cap goes up low in the bay (flange against the
    // backing), then steps out into its hole: those two legs are the whole path
    // the cap, then the switch, go straight into the pocket from the cavity (moving +Y)
    else if (name == "cap_insert") intersection() { right_body(); union() for (dy = [-8 : 0.5 : 0]) translate([BUTTON_X, SW_TOP_Y + dy, BUTTON_Z]) button_cap(); }
    else if (name == "switch_insert") intersection() { union() { right_body(); button_cap_placed(); } union() for (dy = [-8 : 0.5 : 0]) translate([0, dy, 0]) hw_switch(); }
    else if (name == "grille") intersection() { grille_placed(); union() { bone_arm(); hw_transducer(); left_body(); } }
    else if (name == "clamp") intersection() { left_body(); hw_screw_heads(); }
    // the camera goes into the right half moving +Y, then the left half closes over it (relative -Y)
    else if (name == "cap_hw" && CAP) intersection() { camera_cap(); union() { hw_all(); hw_hex(); } }
    else if (name == "cap_halves" && CAP) intersection() { camera_cap(); union() { left_body(); right_body(); } }
    // the cap (camera already on its posts) goes into the right half moving +Y, its bead sliding down the
    // groove; then the left half closes over it (relative -Y)
    else if (name == "cap_mount" && CAP) union() {
        intersection() { right_body(); union() for (dy = [-14 : 0.5 : 0]) translate([0, dy, 0]) union() { camera_cap(); hw_camera(); } }
        intersection() { left_body(); union() for (dy = [0 : 0.5 : 14]) translate([0, dy, 0]) union() { camera_cap(); hw_camera(); } } }
    else if (name == "cam_insert" && CAP) intersection() { camera_cap(); union() for (dx = [0 : 0.5 : 3]) translate([dx, 0, 0]) hw_camera(); }
    else if (name == "cam_insert") union() {
        intersection() { right_body(); union() for (dy = [-14 : 0.5 : 0]) translate([0, dy, 0]) hw_camera(); }
        intersection() { left_body(); union() for (dy = [0 : 0.5 : 14]) translate([0, dy, 0]) hw_camera(); } }
    // the stack goes into the right half moving +Y (Pi side first): the hex standoffs into the pads
    else if (name == "stack_insert") intersection() { right_body(); pad_positions() for (dy = [-6 : 0.25 : 0]) translate([0, PI_TOP_Y + dy, 0]) hex_holed(); }
    else assert(false, str("unknown check: ", name));
}

if (PART == "left") left_body();
else if (PART == "cap") camera_cap();
else if (PART == "print_cap") print_cap();
else if (PART == "right") right_body();
else if (PART == "bone") bone_arm();
else if (PART == "button") button_cap();
else if (PART == "button_placed") button_cap_placed();
else if (PART == "print_left") print_left();
else if (PART == "print_right") print_right();
else if (PART == "print_nose_left") print_nose_left();
else if (PART == "print_pads_test") print_pads_test();
else if (PART == "print_hex_sizes") print_hex_sizes();
else if (PART == "print_panel_switch_test") print_panel_switch_test();
else if (PART == "print_nose_right") print_nose_right();
else if (PART == "print_bone") print_bone();
else if (PART == "print_button") print_button();
else if (PART == "print_grille") print_grille();
else if (PART == "grille") grille_placed();
else if (PART == "lid_placed") button_lid_placed();
else if (PART == "hardware") hardware();
else if (PART == "none") { }
else if (len(PART) > 6 && PART[0] == "c" && PART[1] == "h" && PART[5] == "_") check(chr([for (i = [6 : len(PART) - 1]) ord(PART[i])]));
else assembly();
