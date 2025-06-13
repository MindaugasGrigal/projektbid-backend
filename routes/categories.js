const express = require('express');
const { 
  getAllCategories, 
  getAllSubcategories, 
  getCategoryById, 
  getSubcategoryById,
  getCategoryBySubcategory 
} = require('../constants/categories');

const router = express.Router();

// Get all categories with subcategories
router.get('/', (req, res) => {
  try {
    const categories = getAllCategories();
    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti kategorijų'
    });
  }
});

// Get specific category by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const category = getCategoryById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Kategorija nerasta'
      });
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('❌ Error fetching category:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti kategorijos'
    });
  }
});

// Get all subcategories (flat list)
router.get('/subcategories/all', (req, res) => {
  try {
    const subcategories = getAllSubcategories();
    res.json({
      success: true,
      data: subcategories,
      count: subcategories.length
    });
  } catch (error) {
    console.error('❌ Error fetching subcategories:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti subkategorijų'
    });
  }
});

// Get specific subcategory by ID
router.get('/subcategories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const subcategory = getSubcategoryById(id);
    
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        error: 'Subkategorija nerasta'
      });
    }
    
    // Also include parent category info
    const parentCategory = getCategoryBySubcategory(id);
    
    res.json({
      success: true,
      data: {
        ...subcategory,
        parentCategory: {
          id: parentCategory.id,
          name: parentCategory.name
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching subcategory:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti subkategorijos'
    });
  }
});

// Search categories and subcategories
router.get('/search/:query', (req, res) => {
  try {
    const { query } = req.params;
    const searchTerm = query.toLowerCase();
    
    const categories = getAllCategories();
    const results = {
      categories: [],
      subcategories: []
    };
    
    categories.forEach(category => {
      // Search in category names
      if (category.name.toLowerCase().includes(searchTerm) || 
          category.description.toLowerCase().includes(searchTerm)) {
        results.categories.push(category);
      }
      
      // Search in subcategories
      category.subcategories.forEach(subcategory => {
        if (subcategory.name.toLowerCase().includes(searchTerm)) {
          results.subcategories.push({
            ...subcategory,
            parentCategory: {
              id: category.id,
              name: category.name
            }
          });
        }
      });
    });
    
    res.json({
      success: true,
      query: query,
      data: results,
      totalFound: results.categories.length + results.subcategories.length
    });
  } catch (error) {
    console.error('❌ Error searching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko ieškoti kategorijų'
    });
  }
});

module.exports = router;

