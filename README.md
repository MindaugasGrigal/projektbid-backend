# ProjektBid Backend API

A Node.js/Express backend API for a project bidding platform where clients can post projects and providers can submit proposals.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access (CLIENT/PROVIDER)
- **Project Management**: Create and view projects with deadlines and priorities
- **Proposal System**: Providers can submit bids on projects
- **Security**: Rate limiting, helmet security headers, input validation
- **Database**: PostgreSQL with Prisma ORM
- **Logging**: Request/response logging with timestamps

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Validation**: express-validator
- **Security**: helmet, express-rate-limit
- **Development**: nodemon

## 📋 Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- npm or yarn

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd projektbid-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database URL and other configurations.

4. **Generate Prisma client**
   ```bash
   npm run db:generate
   ```

5. **Push database schema**
   ```bash
   npm run db:push
   ```

6. **Seed the database (optional)**
   ```bash
   npm run db:seed
   ```

## 🏃‍♂️ Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on `http://localhost:4000` (or your configured PORT).

## 📚 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user info (protected)

### Projects
- `GET /projects` - Get all projects (supports filtering by category, priority, budget, search)
- `GET /projects/:id` - Get specific project with proposals
- `POST /projects` - Create new project (protected, CLIENT only)

### Proposals
- `POST /proposals` - Submit proposal to project (protected, PROVIDER only)

### Categories
- `GET /categories` - Get all categories with subcategories
- `GET /categories/:id` - Get specific category
- `GET /categories/subcategories/all` - Get all subcategories (flat list)
- `GET /categories/subcategories/:id` - Get specific subcategory with parent info
- `GET /categories/search/:query` - Search categories and subcategories

### System
- `GET /` - API documentation
- `GET /health` - Health check endpoint

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🎯 User Roles

- **CLIENT**: Can create projects and view proposals
- **PROVIDER**: Can submit proposals to projects

## 📊 Database Schema

### User
- id (UUID)
- email (unique)
- name
- password (hashed)
- role (CLIENT/PROVIDER)
- createdAt

### Project
- id (UUID)
- clientId (FK to User)
- title
- description
- category
- budgetRange
- deadline
- priority (PRICE/SPEED/EXPERIENCE)
- createdAt
- endsAt

### Proposal
- id (UUID)
- providerId (FK to User)
- projectId (FK to Project)
- price
- duration (days)
- comment
- createdAt

## 🏠 Categories

The platform supports predefined categories and subcategories:

### 🏠 Interior Decoration
- Tile laying
- Painting  
- Floor installation
- Plaster installation
- Demolition work
- Garbage removal

### 🔌 Engineering
- Electricians, electrical work
- Plumbing, plumbing work
- Ventilation, ventilation systems
- Boiler installation, repair
- Water filters
- Gas introduction, connection

### 🧱 Construction and Environment
- Construction work
- Window, door installation
- Roofing
- Fences, gates
- Insulation
- Excavation
- Environmental management
- Woodwork
- Concreting

### 🔧 Specialized Work
- Alarms / cameras
- Metal products
- Glass structures
- Alternative energy
- Tool rental

## 🛡️ Security Features

- **Rate Limiting**: General (100 req/15min) and Auth (5 req/15min)
- **Helmet**: Security headers
- **Input Validation**: express-validator for all inputs
- **Password Hashing**: bcrypt with configurable rounds
- **JWT Expiration**: 7-day token expiry
- **CORS**: Configurable origins

## 🧪 Testing

To test the API endpoints, you can use the seeded data:

**Client Account:**
- Email: `client@example.com`
- Password: `client123`

**Provider Account:**
- Email: `provider@example.com`
- Password: `provider123`

## 📝 Development Scripts

```bash
npm run dev          # Start with nodemon
npm run start        # Start production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database with sample data
```

## 🔍 Logging

The application logs:
- All incoming requests with timestamps
- Response status codes and timing
- Database queries (in development)
- Errors with stack traces

## 🌱 Environment Variables

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development|production
PORT=4000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
BCRYPT_ROUNDS=12
```

## 🚀 Deployment

1. Set up your production database
2. Configure environment variables
3. Run database migrations
4. Start the application

## 📄 License

This project is licensed under the ISC License.

