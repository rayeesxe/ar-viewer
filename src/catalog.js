// 3D objects that use standard materials only (no glass/sheen/iridescence/Draco/webp),
// so the AR engine can draw every one of them. Pulled from five public GitHub repos.
const K = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/';
const k = (id) => `${K}${id}/glTF-Binary/${id}.glb`;
const O = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/';
const o = (id) => `${O}${id}/glTF-Binary/${id}.glb`;
const T = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/';
const M = 'https://raw.githubusercontent.com/google/model-viewer/master/packages/shared-assets/models/';
const B = 'https://raw.githubusercontent.com/BabylonJS/Assets/master/meshes/';

export const CATALOG = [
  // Food
  { id: 'avocado', url: k('Avocado'), name: 'Avocado', tags: 'fruit food green', cat: 'Food' },
  { id: 'kebab', url: M + 'shishkebab.glb', name: 'Shish Kebab', tags: 'food kebab grill bbq', cat: 'Food' },
  { id: 'pumpkin', url: B + 'pumpkinBucketCarved.glb', name: 'Pumpkin', tags: 'pumpkin halloween vegetable', cat: 'Food' },

  // Everyday and props
  { id: 'bottle', url: k('WaterBottle'), name: 'Water Bottle', tags: 'drink bottle flask', cat: 'Everyday' },
  { id: 'lantern', url: k('Lantern'), name: 'Street Lantern', tags: 'lamp light street lantern', cat: 'Everyday' },
  { id: 'barrel', url: B + 'ExplodingBarrel.glb', name: 'Barrel', tags: 'barrel drum oil', cat: 'Everyday' },
  { id: 'buoy', url: B + 'babylonBuoy.glb', name: 'Buoy', tags: 'buoy sea float', cat: 'Everyday' },
  { id: 'helmet', url: k('DamagedHelmet'), name: 'Sci-fi Helmet', tags: 'helmet space armour', cat: 'Everyday' },

  // Electronics and machines
  { id: 'boombox', url: k('BoomBox'), name: 'Boombox', tags: 'radio music speaker retro', cat: 'Electronics' },
  { id: 'camera', url: k('AntiqueCamera'), name: 'Antique Camera', tags: 'camera photo vintage tripod', cat: 'Electronics' },
  { id: 'engine', url: o('2CylinderEngine'), name: 'Engine', tags: 'engine motor machine cylinder', cat: 'Machines' },
  { id: 'gearbox', url: o('GearboxAssy'), name: 'Gearbox', tags: 'gearbox gears machine', cat: 'Machines' },
  { id: 'saw', url: o('ReciprocatingSaw'), name: 'Power Saw', tags: 'saw tool power drill', cat: 'Machines' },
  { id: 'iondrive', url: T + 'PrimaryIonDrive.glb', name: 'Ion Drive', tags: 'engine space thruster', cat: 'Machines' },

  // Fashion
  { id: 'shoe', url: k('MaterialsVariantsShoe'), name: 'Sneaker', tags: 'shoe trainer footwear', cat: 'Fashion' },
  { id: 'corset', url: k('Corset'), name: 'Corset', tags: 'clothing fashion', cat: 'Fashion' },

  // Vehicles
  { id: 'truck', url: k('CesiumMilkTruck'), name: 'Milk Truck', tags: 'truck vehicle van', cat: 'Vehicles' },
  { id: 'car', url: B + 'car.glb', name: 'Toy Car', tags: 'car vehicle toy', cat: 'Vehicles' },
  { id: 'buggy', url: o('Buggy'), name: 'Buggy', tags: 'buggy car offroad vehicle', cat: 'Vehicles' },
  { id: 'rocket', url: M + 'RocketShip.glb', name: 'Rocket Ship', tags: 'rocket space ship toy', cat: 'Vehicles' },
  { id: 'ship', url: B + 'blackPearl.glb', name: 'Pirate Ship', tags: 'ship boat pirate sail', cat: 'Vehicles' },

  // People and characters
  { id: 'astronaut', url: M + 'Astronaut.glb', name: 'Astronaut', tags: 'astronaut space person', cat: 'People' },
  { id: 'armstrong', url: M + 'NeilArmstrong.glb', name: 'Neil Armstrong', tags: 'astronaut moon person statue', cat: 'People' },
  { id: 'soldier', url: T + 'Soldier.glb', name: 'Soldier', tags: 'soldier person man', cat: 'People' },
  { id: 'girl', url: B + 'HVGirl.glb', name: 'Girl', tags: 'girl person woman character', cat: 'People' },
  { id: 'man', url: k('CesiumMan'), name: 'Walking Man', tags: 'man person', cat: 'People' },
  { id: 'robot', url: M + 'RobotExpressive.glb', name: 'Robot', tags: 'robot toy character', cat: 'Characters' },
  { id: 'mannequin', url: B + 'Xbot.glb', name: 'Mannequin', tags: 'mannequin robot body', cat: 'Characters' },
  { id: 'dancer', url: k('BrainStem'), name: 'Robot Dancer', tags: 'robot dancer', cat: 'Characters' },
  { id: 'alien', url: B + 'alien.glb', name: 'Alien', tags: 'alien monster space', cat: 'Characters' },

  // Animals
  { id: 'fox', url: k('Fox'), name: 'Fox', tags: 'fox animal', cat: 'Animals' },
  { id: 'horse', url: T + 'Horse.glb', name: 'Horse', tags: 'horse animal', cat: 'Animals' },
  { id: 'fish', url: k('BarramundiFish'), name: 'Barramundi Fish', tags: 'fish animal sea', cat: 'Animals' },
  { id: 'octopus', url: B + 'octopus_customRig.glb', name: 'Octopus', tags: 'octopus sea animal', cat: 'Animals' },
  { id: 'parrot', url: T + 'Parrot.glb', name: 'Parrot', tags: 'parrot bird animal', cat: 'Animals' },
  { id: 'flamingo', url: T + 'Flamingo.glb', name: 'Flamingo', tags: 'flamingo bird animal', cat: 'Animals' },
  { id: 'stork', url: T + 'Stork.glb', name: 'Stork', tags: 'stork bird animal', cat: 'Animals' },

  // Toys and games
  { id: 'duck', url: k('Duck'), name: 'Rubber Duck', tags: 'duck toy bath', cat: 'Toys' },
  { id: 'dice', url: B + 'D20_Animation.glb', name: 'D20 Dice', tags: 'dice game d20', cat: 'Toys' },
  { id: 'bowlingball', url: B + 'bowlingBall.glb', name: 'Bowling Ball', tags: 'bowling ball sport', cat: 'Toys' },
  { id: 'bowlingpin', url: B + 'bowlingPinpin.glb', name: 'Bowling Pin', tags: 'bowling pin sport', cat: 'Toys' },

  // Places
  { id: 'house', url: B + 'house_scene.glb', name: 'House', tags: 'house home building', cat: 'Places' },
  { id: 'village', url: B + 'village.glb', name: 'Village', tags: 'village town houses', cat: 'Places' },
  { id: 'city', url: k('VirtualCity'), name: 'Mini City', tags: 'city town buildings', cat: 'Places' },
];

export const CATEGORIES = ['All', ...Array.from(new Set(CATALOG.map((c) => c.cat)))];

// Best catalog match for free text ("show me a fox", "how to make a kebab").
export function matchObject(text) {
  if (!text) return null;
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')} `;
  const byId =
    [...CATALOG].sort((a, b) => b.name.length - a.name.length).find((c) => t.includes(` ${c.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')} `)) ||
    CATALOG.find((c) => t.includes(` ${c.id} `));
  if (byId) return byId;
  return (
    CATALOG.find((c) =>
      c.tags
        .split(' ')
        .filter((w) => w.length > 3 && !['person', 'animal', 'toy', 'space', 'vehicle', 'machine', 'food'].includes(w))
        .some((w) => t.includes(` ${w} `))
    ) || null
  );
}
