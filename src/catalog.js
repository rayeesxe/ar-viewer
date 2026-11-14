// 3D objects that use standard materials only (no glass/sheen/iridescence/Draco),
// so the AR engine can draw every one of them.
const K = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/';
const k = (id) => `${K}${id}/glTF-Binary/${id}.glb`;
const T = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/';
const M = 'https://raw.githubusercontent.com/google/model-viewer/master/packages/shared-assets/models/';

export const CATALOG = [
  { id: 'helmet', url: k('DamagedHelmet'), name: 'Sci-fi Helmet', tags: 'helmet space armour', cat: 'Props' },
  { id: 'boombox', url: k('BoomBox'), name: 'Boombox', tags: 'radio music speaker retro', cat: 'Electronics' },
  { id: 'camera', url: k('AntiqueCamera'), name: 'Antique Camera', tags: 'camera photo vintage tripod', cat: 'Electronics' },
  { id: 'lantern', url: k('Lantern'), name: 'Street Lantern', tags: 'lamp light street lantern', cat: 'Lighting' },
  { id: 'bottle', url: k('WaterBottle'), name: 'Water Bottle', tags: 'drink bottle flask', cat: 'Everyday' },
  { id: 'avocado', url: k('Avocado'), name: 'Avocado', tags: 'fruit food green', cat: 'Food' },
  { id: 'kebab', url: M + 'shishkebab.glb', name: 'Shish Kebab', tags: 'food kebab grill', cat: 'Food' },
  { id: 'shoe', url: k('MaterialsVariantsShoe'), name: 'Sneaker', tags: 'shoe trainer footwear', cat: 'Fashion' },
  { id: 'corset', url: k('Corset'), name: 'Corset', tags: 'clothing fashion', cat: 'Fashion' },
  { id: 'truck', url: k('CesiumMilkTruck'), name: 'Milk Truck', tags: 'truck vehicle car van', cat: 'Vehicles' },
  { id: 'rocket', url: M + 'RocketShip.glb', name: 'Rocket Ship', tags: 'rocket space ship toy', cat: 'Vehicles' },
  { id: 'astronaut', url: M + 'Astronaut.glb', name: 'Astronaut', tags: 'astronaut space person', cat: 'People' },
  { id: 'robot', url: M + 'RobotExpressive.glb', name: 'Robot', tags: 'robot toy character', cat: 'Characters' },
  { id: 'fox', url: k('Fox'), name: 'Fox', tags: 'fox animal', cat: 'Animals' },
  { id: 'horse', url: T + 'Horse.glb', name: 'Horse', tags: 'horse animal', cat: 'Animals' },
  { id: 'fish', url: k('BarramundiFish'), name: 'Barramundi Fish', tags: 'fish animal sea', cat: 'Animals' },
  { id: 'parrot', url: T + 'Parrot.glb', name: 'Parrot', tags: 'parrot bird animal', cat: 'Animals' },
  { id: 'flamingo', url: T + 'Flamingo.glb', name: 'Flamingo', tags: 'flamingo bird animal', cat: 'Animals' },
  { id: 'duck', url: k('Duck'), name: 'Rubber Duck', tags: 'duck toy bath', cat: 'Toys' },
];
