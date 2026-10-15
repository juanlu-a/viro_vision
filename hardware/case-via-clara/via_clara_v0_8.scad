// VIA Clara v0.8 — corrected for Raspberry Pi AI Camera + Pi Zero 2 W + Waveshare UPS HAT(C)
// 4 primary printed parts: LEFT BODY, RIGHT BODY, AI CAMERA FRONT CAP, HOLLOW BONE ARM
// + button cap printed x2
// Units: mm

$fn=56;
PART=is_undef(PART)?"assembly":PART;
SHOW_HW=is_undef(SHOW_HW)?false:SHOW_HW;

// ---------- Hardware ----------
PI_L=65;
PI_W=30;
PI_CX=3.0; // stack moved rearward to leave front clearance for UPS switch/camera cable
PI_HOLE_X=29.0; // 58 mm pitch
PI_HOLE_Z=11.5; // 23 mm pitch
STACK_T=16.5;

// Raspberry Pi AI Camera official mechanical data
AI_CAM_W=25.0;
AI_CAM_H=23.862;
AI_CAM_TOTAL_DEPTH=11.9;
AI_CAM_PCB_T=1.12;
AI_CAM_LENS_OFFSET_Y=0.30;   // 12.8 from 25 mm edge => +0.3 from centre
AI_CAM_LENS_OFFSET_Z=0.569;  // 12.5 from 23.862 mm edge => +0.569 from centre
AI_CAM_LENS_D=6.35;          // 5.75 nominal lens feature + print clearance
AI_CAM_OPT_W=13.2;           // clearance around optical block (~12 mm nominal)
AI_CAM_OPT_H=20.5;           // clearance around optical block (~19.5 mm nominal)
AI_CAM_OPT_DEPTH=7.5;        // 6.98 nominal forward optical depth + clearance
AI_CAM_HOLE_Y=10.5;          // 2 mm from each 25 mm edge
AI_CAM_HOLE_Z_TOP=9.931;     // 2 mm from top on 23.862 board
AI_CAM_HOLE_Z_BOT=-2.569;    // 14.5 mm from top
AI_CAM_PEG_D=1.8;            // into Ø2.2 camera holes

FRONT_SPLIT_X=-31.6;
CAM_BOARD_X=-34.0;

// Buttons: command + volume
BUTTON_XS=[-5.5,8.5];
BUTTON_Z=2.6;
BUTTON_HOLE_D=5.4;

// enlarged transducer cavity: previous 14.8 + 2 mm
TRANSDUCER_INNER=16.8;
TRANSDUCER_WALL=2.2;
TRANSDUCER_OUTER=TRANSDUCER_INNER+2*TRANSDUCER_WALL;
TRANSDUCER_CENTER=[69.0,-22.0,-16.0];

// organic main body stations: X, total Y width, total Z height, radius
stations=[
    [-32.0,28.2,35.2,6.0],
    [-22.0,24.8,35.6,6.4],
    [ -5.0,24.2,35.6,6.5],
    [ 13.0,23.8,35.4,6.3],
    [ 27.0,23.5,35.0,6.0],
    [ 34.0,22.8,34.2,5.6],
    [ 38.0,18.2,27.8,5.0],
    [ 41.0,11.8,19.4,4.3]
];

// custom camera cap stations extend farther forward for 11.9 mm AI Camera depth
cam_stations=[
    [FRONT_SPLIT_X,28.2,35.2,6.0],
    [-35.0,29.0,33.0,6.0],
    [-41.8,28.0,30.2,5.6],
    [-44.0,27.0,29.0,5.2]
];

module rr2d(s=[10,10],r=2){offset(r=r)square([max(.2,s[0]-2*r),max(.2,s[1]-2*r)],center=true);}
module rounded_box3d(size=[10,10,10],r=1.5){minkowski(){cube([max(.2,size[0]-2*r),max(.2,size[1]-2*r),max(.2,size[2]-2*r)],center=true);sphere(r=r,$fn=24);}}
module rounded_prism_x(L,W,H,r=2,center=true){translate(center?[-L/2,0,0]:[0,0,0])rotate([0,90,0])linear_extrude(height=L,center=false)rr2d([H,W],r);}
module slice_x(x,w,h,r,t=.30){translate([x,0,0])rotate([0,90,0])linear_extrude(height=t,center=true)rr2d([h,w],r);}
module capsule(p1,p2,r=2){hull(){translate(p1)sphere(r=r,$fn=28);translate(p2)sphere(r=r,$fn=28);}}
module hex_prism(af=5.7,h=2.8){rotate([90,0,0])cylinder(h=h,r=af/sqrt(3),$fn=6,center=true);}

module loft(st){union(){for(i=[0:len(st)-2])hull(){slice_x(st[i][0],st[i][1],st[i][2],st[i][3]);slice_x(st[i+1][0],st[i+1][1],st[i+1][2],st[i+1][3]);}}}
module outer_body(){loft(stations);}
module camera_outer(){loft(cam_stations);}

module electronics_cavity(){translate([PI_CX,0,0])rounded_prism_x(67.2,19.6,31.8,2.5,true);}

// ---------- External hardware openings ----------
module access_cuts(){
    // microSD at rear short edge; enlarged for card insertion/removal
    translate([38.0,0,4.0]) rounded_box3d([8.0,8.0,15.5],1.0);
    // UPS HAT(C) ON/OFF lever at front short edge
    translate([-31.2,0,0]) rounded_box3d([5.5,8.5,8.2],1.0);
    // charging / small control area of UPS at front-low region
    translate([-29.5,6.5,-10.0]) rounded_box3d([8.0,7.0,7.5],1.0);
    // Pi long-edge USB / HDMI access region based on the physical stack orientation in user photos
    translate([7.0,12.0,0]) rounded_box3d([29.0,4.0,23.0],1.0);
}

module rear_shell_raw(){difference(){outer_body();electronics_cavity();access_cuts();}}

// ---------- Two body screws OUTSIDE the PCB footprint ----------
// one above the board, one below the board; board occupies Z +/-15 mm
SCREW_POS=[[-7.0,18.7],[20.0,-18.7]];
module screw_lugs(){
    for(p=SCREW_POS)
        translate([p[0],0,p[1]]) rotate([90,0,0]) cylinder(h=29,d=8.2,center=true);
}
module screw_holes(){for(p=SCREW_POS)translate([p[0],0,p[1]])rotate([90,0,0])cylinder(h=40,d=3.4,center=true);}
module screw_head_recess(){for(p=SCREW_POS)translate([p[0],13.0,p[1]])rotate([90,0,0])cylinder(h=3.0,d=6.7,center=true);}
module screw_nut_traps(){for(p=SCREW_POS)translate([p[0],-13.0,p[1]])hex_prism(5.8,3.0);}

// ---------- Elastic anchors ----------
module elastic_anchor(x){translate([x,-13.4,0])difference(){rounded_box3d([5.2,4.2,16.0],1.3);cube([6.5,2.0,11.8],center=true);}}

// ---------- Melt-in landing pads for the existing metal standoffs ----------
module melt_pad(x,z){
    // no locating pin; solid filament volume for heat-setting the metal leg
    translate([x,-11.1,z])rotate([-90,0,0])cylinder(h=4.4,d=8.0,center=false);
}
module melt_pads(){for(dx=[-PI_HOLE_X,PI_HOLE_X])for(z=[-PI_HOLE_Z,PI_HOLE_Z])melt_pad(PI_CX+dx,z);}
module guide_rails(){
    // shallow rails only; do not overlap metal standoffs
    translate([PI_CX,-10.1,15.7])rounded_box3d([51.0,1.8,1.0],.25);
    translate([PI_CX,-10.1,-15.7])rounded_box3d([51.0,1.8,1.0],.25);
}

// ---------- Bone arm socket ----------
module bone_socket_boss(){translate([29,-13.2,-.5])rounded_box3d([13.2,5.4,15.4],2);}
module bone_socket_cut(){translate([29,-15,-.5])rounded_box3d([9.2,6.3,11.3],1.1);}
module bone_cable_port(){translate([29,-8,-.5])rotate([90,0,0])cylinder(h=12.5,d=3.4,center=false);}

// ---------- Camera-cap attachment: pegs are ABOVE/BELOW the AI camera board ----------
// Camera PCB Z spans ~ +/-11.93. These pegs sit at +/-15.3, outside the PCB and its mounting pillars.
CAP_PEG_Y=[-7.5,7.5];
CAP_PEG_Z=[-15.3,15.3];
module camera_body_sockets(){for(y=CAP_PEG_Y)for(z=CAP_PEG_Z)translate([FRONT_SPLIT_X-.4,y,z])rotate([0,90,0])cylinder(h=5.5,d=2.9,center=false);}
module camera_cap_pegs(){for(y=CAP_PEG_Y)for(z=CAP_PEG_Z){translate([FRONT_SPLIT_X-.25,y,z])rotate([0,90,0])cylinder(h=4.6,d=2.55,center=false);translate([FRONT_SPLIT_X+3.7,y,z])rotate([0,90,0])cylinder(h=.7,d1=3.0,d2=2.55,center=false);}}

// ---------- Left/right bodies ----------
module left_raw(){union(){intersection(){rear_shell_raw();translate([0,-50,0])cube([160,100,120],center=true);}intersection(){screw_lugs();translate([0,-50,0])cube([160,100,120],center=true);}elastic_anchor(-19.5);elastic_anchor(23);bone_socket_boss();melt_pads();guide_rails();}}
module left_body(){difference(){left_raw();screw_holes();screw_nut_traps();bone_socket_cut();bone_cable_port();camera_body_sockets();}}

module right_raw(){union(){intersection(){rear_shell_raw();translate([0,50,0])cube([160,100,120],center=true);}intersection(){screw_lugs();translate([0,50,0])cube([160,100,120],center=true);}}}
module button_holes(){for(x=BUTTON_XS)translate([x,18,BUTTON_Z])rotate([90,0,0])cylinder(h=28,d=BUTTON_HOLE_D,center=false);}
module right_body(){difference(){right_raw();screw_holes();screw_head_recess();button_holes();camera_body_sockets();}}

// ---------- Raspberry Pi AI Camera cap ----------
module ai_camera_board_pocket(){
    // rear-open board pocket with 0.5-0.7 mm print clearance
    translate([CAM_BOARD_X,0,0])rounded_box3d([4.8,25.8,24.6],1.3);
    translate([FRONT_SPLIT_X-.8,0,0])cube([5.0,26.2,25.2],center=true);
}
module ai_optical_clearance(){
    // official optical block is forward of PCB; leave generous rectangular clearance
    translate([CAM_BOARD_X-AI_CAM_OPT_DEPTH/2+0.2,AI_CAM_LENS_OFFSET_Y,AI_CAM_LENS_OFFSET_Z])
        rounded_box3d([AI_CAM_OPT_DEPTH,AI_CAM_OPT_W,AI_CAM_OPT_H],1.0);
}
module ai_lens_opening(){
    translate([-45.0,AI_CAM_LENS_OFFSET_Y,AI_CAM_LENS_OFFSET_Z])rotate([0,90,0])cylinder(h=13,d=AI_CAM_LENS_D,center=false);
}
module camera_csi_notch(){translate([FRONT_SPLIT_X-.9,0,-10.4])cube([5.0,14.0,3.2],center=true);}

module camera_support(y,z){
    // shoulder + small peg into AI Camera Ø2.2 mounting hole. No other cap pegs share this area.
    translate([-37.0,y,z])rotate([0,90,0])cylinder(h=2.8,d=4.3,center=false);
    translate([-34.35,y,z])rotate([0,90,0])cylinder(h=2.0,d=AI_CAM_PEG_D,center=false);
    translate([-32.45,y,z])rotate([0,90,0])cylinder(h=.7,d1=AI_CAM_PEG_D,d2=1.35,center=false);
}
module camera_four_supports(){
    for(y=[-AI_CAM_HOLE_Y,AI_CAM_HOLE_Y]){
        camera_support(y,AI_CAM_HOLE_Z_TOP);
        camera_support(y,AI_CAM_HOLE_Z_BOT);
    }
}
module camera_support_frame(){
    // frame only at outer perimeter; central optical region is fully clear
    translate([-37.0,0,0])difference(){cube([1.4,27.2,25.8],center=true);cube([2.5,20.0,21.0],center=true);}
}
module camera_rear_rim(){translate([FRONT_SPLIT_X-.3,0,0])difference(){rounded_box3d([1.4,28.0,34.0],.55);cube([2.5,26.3,25.4],center=true);}}
module camera_cap(){union(){difference(){camera_outer();ai_camera_board_pocket();ai_optical_clearance();ai_lens_opening();camera_csi_notch();}camera_support_frame();camera_four_supports();camera_rear_rim();camera_cap_pegs();}}

// ---------- Hollow bone arm ----------
arm_pts=[[29,-18,-.5],[36.5,-18.2,-.8],[44,-19,-2.5],[52,-20.1,-6.1],[59,-21.2,-10.8],[64,-22,-14.9]];
module bone_outer(){union(){for(i=[0:len(arm_pts)-2])capsule(arm_pts[i],arm_pts[i+1],2.7);}}
module bone_tunnel(){p0=[29,-12.8,-.5];pN=[66.2,-22,-15.4];union(){capsule(p0,arm_pts[0],1.3);for(i=[0:len(arm_pts)-2])capsule(arm_pts[i],arm_pts[i+1],1.3);capsule(arm_pts[len(arm_pts)-1],pN,1.3);}}
module bone_plug(){union(){translate([29,-16.2,-.5])rounded_box3d([8.7,4.9,10.8],1);translate([29,-17,5])sphere(r=.55);translate([29,-17,-6])sphere(r=.55);}}
module transducer_cradle(){translate(TRANSDUCER_CENTER)rounded_box3d([TRANSDUCER_OUTER,8.8,TRANSDUCER_OUTER],2.3);}
module transducer_pocket(){translate([TRANSDUCER_CENTER[0],TRANSDUCER_CENTER[1]-2.2,TRANSDUCER_CENTER[2]])cube([TRANSDUCER_INNER,7.4,TRANSDUCER_INNER],center=true);}
module bone_arm(){difference(){union(){bone_plug();bone_outer();transducer_cradle();}bone_tunnel();transducer_pocket();translate([29,-13.6,-.5])rotate([90,0,0])cylinder(h=3.8,d=2.8,center=true);translate([64.6,-22,-15.4])rotate([0,90,0])cylinder(h=7.4,d=2.8,center=false);}}

module button_cap(){union(){rotate([90,0,0])linear_extrude(height=1.8,center=true)rr2d([7.2,5.6],1.55);translate([0,-2,0])rotate([90,0,0])cylinder(h=3,d=4.1,center=true);translate([0,-3.4,0])rotate([90,0,0])cylinder(h=.7,d=5,center=true);}}

module hw_ref(){color([.1,.45,.15,.3])translate([PI_CX,0,0])cube([PI_L,STACK_T,PI_W],center=true);color([.1,.2,.8,.35])translate([CAM_BOARD_X,0,0])cube([1.12,AI_CAM_W,AI_CAM_H],center=true);}
module assembly(){color("#303030")left_body();color("#404040")right_body();color("#242424")camera_cap();color("#202020")bone_arm();if(SHOW_HW)hw_ref();}

if(PART=="left")left_body();
else if(PART=="right")right_body();
else if(PART=="camera_cap")camera_cap();
else if(PART=="bone")bone_arm();
else if(PART=="button")button_cap();
else assembly();
