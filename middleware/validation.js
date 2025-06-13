const { body, query, validationResult } = require('express-validator');

// Validation rules for user registration
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Neteisingas el. pašto formatas'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Vardas turi būti tarp 2 ir 50 simbolių'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Slaptažodis turi būti mažiausiai 6 simboliai')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Slaptažodis turi turėti mažąją, didžiąją raidę ir skaičių'),
  body('role')
    .isIn(['CLIENT', 'PROVIDER'])
    .withMessage('Rolė turi būti CLIENT arba PROVIDER')
];

// Validation rules for project creation
const validateProject = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Pavadinimas turi būti tarp 5 ir 100 simbolių'),
  body('description')
    .trim()
    .isLength({ min: 20, max: 1000 })
    .withMessage('Aprašymas turi būti tarp 20 ir 1000 simbolių'),
  body('category')
    .trim()
    .custom((value) => {
      const { validateCategory, validateSubcategory } = require('../constants/categories');
      if (!validateCategory(value) && !validateSubcategory(value)) {
        throw new Error('Nepavaldi kategorija. Naudokite tik iš anksto nustatytas kategorijas.');
      }
      return true;
    }),
  body('budgetRange')
    .trim()
    .notEmpty()
    .withMessage('Biudžeto diapazonas yra privalomas'),
  body('deadline')
    .isISO8601()
    .toDate()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Terminas turi būti ateityje');
      }
      return true;
    }),
  body('priority')
    .isIn(['PRICE', 'SPEED', 'EXPERIENCE'])
    .withMessage('Prioritetas turi būti PRICE, SPEED arba EXPERIENCE')
];

// Validation rules for proposal creation
const validateProposal = [
  body('projectId')
    .isUUID()
    .withMessage('Neteisingas projekto ID'),
  body('price')
    .isInt({ min: 1 })
    .withMessage('Kaina turi būti teigiamas skaičius'),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Trukmė turi būti teigiamas skaičius'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Komentaras negali būti ilgesnis nei 500 simbolių')
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validacijos klaidos',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Validation rules for search parameters
const validateSearchParams = [
  query('query')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query cannot be longer than 100 characters'),
  query('category')
    .optional()
    .trim()
    .custom((value) => {
      if (value) {
        const { validateCategory, validateSubcategory } = require('../constants/categories');
        if (!validateCategory(value) && !validateSubcategory(value)) {
          throw new Error('Invalid category. Use only predefined categories.');
        }
      }
      return true;
    }),
  query('location')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Location cannot be longer than 50 characters'),
  query('budgetMin')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum budget must be a positive number'),
  query('budgetMax')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum budget must be a positive number')
    .custom((value, { req }) => {
      if (value && req.query.budgetMin && parseFloat(value) < parseFloat(req.query.budgetMin)) {
        throw new Error('Maximum budget must be greater than minimum budget');
      }
      return true;
    }),
  query('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be LOW, MEDIUM, HIGH, or URGENT'),
  query('phase')
    .optional()
    .isIn(['ACTIVE', 'COMPLETED', 'CANCELLED', 'DRAFT'])
    .withMessage('Phase must be ACTIVE, COMPLETED, CANCELLED, or DRAFT'),
  query('sortBy')
    .optional()
    .isIn(['ending_soon', 'newest', 'budget_low', 'budget_high'])
    .withMessage('Sort by must be ending_soon, newest, budget_low, or budget_high'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateProject,
  validateProposal,
  validateSearchParams,
  handleValidationErrors
};

