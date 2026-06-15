/**
 * ADE20K semantic classes used by DeepLab (MIT Scene Parsing).
 * Index matches @tensorflow-models/deeplab ade20k output labels.
 */

/** Primary wall surface — wallpaper target. */
export const ADE20K_WALL = 0;

/**
 * Classes that must never receive wallpaper (occluders + non-wall surfaces).
 * Keeps doors, windows, fixtures, furniture, ceiling, floor visible.
 */
export const ADE20K_OCCLUDERS = new Set([
  1, // building (exterior)
  2, // sky
  3, // floor
  4, // tree
  5, // ceiling
  6, // road
  7, // bed
  8, // windowpane
  9, // grass
  10, // cabinet
  11, // sidewalk
  12, // person
  14, // door
  15, // table
  17, // plant
  18, // curtain
  19, // chair
  20, // car
  22, // painting
  23, // sofa
  24, // shelf
  27, // mirror
  28, // rug
  30, // armchair
  31, // seat
  33, // desk
  35, // wardrobe
  36, // lamp
  37, // bathtub
  39, // cushion
  44, // chest of drawers
  45, // counter
  47, // sink
  49, // fireplace
  50, // refrigerator
  57, // pillow
  58, // screen door
  62, // bookcase
  63, // blind
  64, // coffee table
  65, // toilet
  70, // countertop
  71, // stove
  73, // kitchen island
  74, // computer
  75, // swivel chair
  82, // light
  85, // chandelier
  89, // television receiver
  97, // ottoman
  110, // stool
  130, // screen
  134, // sconce
  141, // crt screen
  143, // monitor
  146, // radiator
  148, // clock
]);
