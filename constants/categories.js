// Predefined categories for ProjektBid platform
const CATEGORIES = {
  INTERIOR_DECORATION: {
    id: 'interior_decoration',
    name: '🏠 Interior decoration',
    description: 'Interior decoration work',
    subcategories: [
      { id: 'tile_laying', name: 'Tile laying' },
      { id: 'painting', name: 'Painting' },
      { id: 'floor_installation', name: 'Floor installation' },
      { id: 'plaster_installation', name: 'Plaster installation' },
      { id: 'demolition_work', name: 'Demolition work' },
      { id: 'garbage_removal', name: 'Garbage removal' }
    ]
  },
  ENGINEERING: {
    id: 'engineering',
    name: '🔌 Engineering',
    description: 'Engineering and technical services',
    subcategories: [
      { id: 'electrical_work', name: 'Electricians, electrical work' },
      { id: 'plumbing_work', name: 'Plumbing, plumbing work' },
      { id: 'ventilation', name: 'Ventilation, ventilation systems' },
      { id: 'boiler_services', name: 'Boiler installation, repair' },
      { id: 'water_filters', name: 'Water filters' },
      { id: 'gas_services', name: 'Gas introduction, connection' }
    ]
  },
  CONSTRUCTION: {
    id: 'construction',
    name: '🧱 Construction and environment',
    description: 'Construction and environmental work',
    subcategories: [
      { id: 'construction_work', name: 'Construction work' },
      { id: 'window_door_installation', name: 'Window, door installation' },
      { id: 'roofing', name: 'Roofing' },
      { id: 'fences_gates', name: 'Fences, gates' },
      { id: 'insulation', name: 'Insulation' },
      { id: 'excavation', name: 'Excavation' },
      { id: 'environmental_management', name: 'Environmental management' },
      { id: 'woodwork', name: 'Woodwork' },
      { id: 'concreting', name: 'Concreting' }
    ]
  },
  SPECIALIZED: {
    id: 'specialized',
    name: '🔧 Specialized work',
    description: 'Specialized and technical services',
    subcategories: [
      { id: 'alarms_cameras', name: 'Alarms / cameras' },
      { id: 'metal_products', name: 'Metal products' },
      { id: 'glass_structures', name: 'Glass structures' },
      { id: 'alternative_energy', name: 'Alternative energy' },
      { id: 'tool_rental', name: 'Tool rental' }
    ]
  }
};

// Helper functions
const getAllCategories = () => {
  return Object.values(CATEGORIES);
};

const getAllSubcategories = () => {
  return Object.values(CATEGORIES).reduce((acc, category) => {
    return [...acc, ...category.subcategories];
  }, []);
};

const getCategoryById = (id) => {
  return Object.values(CATEGORIES).find(cat => cat.id === id);
};

const getSubcategoryById = (id) => {
  return getAllSubcategories().find(sub => sub.id === id);
};

const validateCategory = (categoryId) => {
  return Object.values(CATEGORIES).some(cat => cat.id === categoryId);
};

const validateSubcategory = (subcategoryId) => {
  return getAllSubcategories().some(sub => sub.id === subcategoryId);
};

const getCategoryBySubcategory = (subcategoryId) => {
  return Object.values(CATEGORIES).find(category => 
    category.subcategories.some(sub => sub.id === subcategoryId)
  );
};

module.exports = {
  CATEGORIES,
  getAllCategories,
  getAllSubcategories,
  getCategoryById,
  getSubcategoryById,
  validateCategory,
  validateSubcategory,
  getCategoryBySubcategory
};

