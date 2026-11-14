const BASE =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/';

export const modelUrl = (id) => `${BASE}${id}/glTF-Binary/${id}.glb`;

// Photorealistic test objects (Khronos glTF sample assets, hosted on GitHub)
export const CATALOG = [
  { id: 'DamagedHelmet', name: 'Sci-fi Helmet', tags: 'helmet space armour', cat: 'Props' },
  { id: 'Avocado', name: 'Avocado', tags: 'fruit food green', cat: 'Food' },
  { id: 'BoomBox', name: 'Boombox', tags: 'radio music speaker retro', cat: 'Electronics' },
  { id: 'Lantern', name: 'Street Lantern', tags: 'lamp light street', cat: 'Lighting' },
  { id: 'WaterBottle', name: 'Water Bottle', tags: 'drink bottle flask', cat: 'Everyday' },
  { id: 'ToyCar', name: 'Toy Car', tags: 'car vehicle toy', cat: 'Vehicles' },
  { id: 'CarConcept', name: 'Concept Car', tags: 'car vehicle sports auto', cat: 'Vehicles' },
  { id: 'SheenChair', name: 'Velvet Chair', tags: 'chair seat furniture', cat: 'Furniture' },
  { id: 'GlamVelvetSofa', name: 'Velvet Sofa', tags: 'sofa couch furniture', cat: 'Furniture' },
  { id: 'SheenWoodLeatherSofa', name: 'Leather Sofa', tags: 'sofa couch furniture wood', cat: 'Furniture' },
  { id: 'ChairDamaskPurplegold', name: 'Damask Chair', tags: 'chair seat furniture', cat: 'Furniture' },
  { id: 'SpecularSilkPouf', name: 'Silk Pouf', tags: 'pouf ottoman seat furniture', cat: 'Furniture' },
  { id: 'ChronographWatch', name: 'Chronograph Watch', tags: 'watch clock wrist', cat: 'Accessories' },
  { id: 'MaterialsVariantsShoe', name: 'Sneaker', tags: 'shoe trainer footwear', cat: 'Fashion' },
  { id: 'Corset', name: 'Corset', tags: 'clothing fashion', cat: 'Fashion' },
  { id: 'SunglassesKhronos', name: 'Sunglasses', tags: 'glasses shades', cat: 'Accessories' },
  { id: 'AntiqueCamera', name: 'Antique Camera', tags: 'camera photo vintage', cat: 'Electronics' },
  { id: 'CommercialRefrigerator', name: 'Drinks Fridge', tags: 'fridge refrigerator appliance', cat: 'Appliances' },
  { id: 'AnisotropyBarnLamp', name: 'Barn Lamp', tags: 'lamp light metal', cat: 'Lighting' },
  { id: 'IridescenceLamp', name: 'Iridescent Lamp', tags: 'lamp light', cat: 'Lighting' },
  { id: 'LightsPunctualLamp', name: 'Desk Lamp', tags: 'lamp light desk', cat: 'Lighting' },
  { id: 'GlassVaseFlowers', name: 'Vase of Flowers', tags: 'vase flowers plant glass', cat: 'Decor' },
  { id: 'GlassHurricaneCandleHolder', name: 'Candle Holder', tags: 'candle glass decor', cat: 'Decor' },
  { id: 'DiffuseTransmissionPlant', name: 'House Plant', tags: 'plant pot green', cat: 'Decor' },
  { id: 'DiffuseTransmissionTeacup', name: 'Teacup', tags: 'cup tea drink', cat: 'Everyday' },
  { id: 'IridescentDishWithOlives', name: 'Dish of Olives', tags: 'food olives plate bowl', cat: 'Food' },
  { id: 'PotOfCoals', name: 'Pot of Coals', tags: 'fire coal pot', cat: 'Props' },
  { id: 'TrafficCone', name: 'Traffic Cone', tags: 'cone road', cat: 'Props' },
  { id: 'BarramundiFish', name: 'Barramundi Fish', tags: 'fish animal sea', cat: 'Animals' },
  { id: 'Fox', name: 'Fox', tags: 'fox animal', cat: 'Animals' },
  { id: 'DragonAttenuation', name: 'Glass Dragon', tags: 'dragon glass statue', cat: 'Decor' },
  { id: 'ScatteringSkull', name: 'Skull', tags: 'skull bone', cat: 'Props' },
  { id: 'MosquitoInAmber', name: 'Mosquito in Amber', tags: 'amber insect fossil', cat: 'Decor' },
  { id: 'ABeautifulGame', name: 'Chess Set', tags: 'chess game board', cat: 'Games' },
];
