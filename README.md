<p align="center">
  <img src="assets/mocourse-logo.svg" alt="MoCourse logo" width="360" />
</p>

# MoCourse | E-Learning Platform Backend

A scalable online learning platform backend built with **NestJS**, **PostgreSQL** and **TypeORM**. It provides JWT authentication, role-based access control (student, instructor, admin), course and content management, enrollments, purchases and instructor payment info, with media uploads handled through **Cloudinary**.

## Tech Stack

- **Framework:** NestJS 11, TypeScript
- **Database:** PostgreSQL, TypeORM
- **Auth:** JWT (`@nestjs/jwt`), bcryptjs password hashing
- **Uploads:** Cloudinary + Multer
- **Env:** image uploads need CLOUDINARY_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET
- **Validation:** class-validator, class-transformer
- **Testing:** Jest, Supertest

## Features

- User registration and login with JWT tokens
- Role-based access control (student / instructor / admin) using custom auth and role guards
- Course catalog: categories, courses, sections and lessons
- Student enrollments and learning progress tracking (under active development)
- Course purchases and instructor payment information
- Image and file uploads through Cloudinary

## API Overview

Base URL: `http://localhost:3000`

| Resource | Method & Path |
| --- | --- |
| Users / Auth | `POST /api/user/auth/register` · `POST /api/user/auth/login` · `GET /api/user/currentUser` · `GET /api/user/all_users` · `PATCH /api/user/update` · `PATCH /api/user/updateByAdmin/:id` · `DELETE /api/user/delete` · `DELETE /api/user/deleteByAdmin/:id` |
| Courses | `POST /api/course` · `GET /api/course` · `GET /api/course/myCourses` · `PATCH /api/course/update/:id` · `DELETE /api/course/delete/:id` |
| Categories | `POST /api/category` · `GET /api/category/all` |
| Sections | `POST /api/section` · `GET /api/section/sections/:id` · `PATCH /api/section/update/:id` |
| Enrollments | `POST /api/enrollment/:id` · `GET /api/enrollment/my_enrollments` |
| Purchases | `POST /api/buy/:id` · `PATCH /api/buy/confirm/:id` · `GET /api/buy/myPurchases` · `PATCH /api/buy/update/:id` |
| Instructor payment info | `POST /api/paymentinfo` · `PATCH /api/paymentinfo/update` · `GET /api/paymentinfo/info/:id` · `GET /api/paymentinfo/my` · `GET /api/paymentinfo/all` |

Lesson and progress endpoints are under active development.

## Getting Started

**Prerequisites:** Node.js and a local PostgreSQL server.

```bash
# install dependencies
npm install

# create your environment file (see below)
# then run in watch mode
npm run start:dev
```

The server starts on `http://localhost:3000` (or the port set in `PORT`).

### Environment variables

The app loads `.env.<NODE_ENV>` (for example `.env.development` when running `start:dev`). Required variables:

```env
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=
DB_PORT=

JWT_SECRETKEY=
JWT_EXPIREDIN=

CLOUDINARY_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

PORT=3000
```

> The database host is currently set to `localhost` in the TypeORM config, and schema synchronization is enabled outside production.

## Scripts

```bash
npm run start:dev    # development with watch mode
npm run build        # compile to dist/
npm run start:prod   # run the compiled app
npm run test         # unit tests
npm run test:e2e     # end-to-end tests
npm run lint         # ESLint with auto-fix
```

## Project Structure

```
src/
├── User/                      # users, registration, login
├── category/                  # course categories
├── course/                    # courses
├── section/                   # course sections
├── lesson/                    # lessons
├── enrollment/                # student enrollments
├── progress/                  # learning progress
├── Purchase/                  # course purchases
├── instructor-payment-info/   # instructor payout details
├── common/                    # shared guards (auth, roles) and Cloudinary
└── utils/                     # constants, enums and shared types
```
