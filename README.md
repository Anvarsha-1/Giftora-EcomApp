# Giftora E-commerce Application

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![EJS](https://img.shields.io/badge/EJS-A9A9A9?style=for-the-badge&logo=ejs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Passport.js](https://img.shields.io/badge/Passport.js-34E27A?style=for-the-badge&logo=passport&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=3395FF)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)

## Overview

Giftora E-commerce Application is a comprehensive, full-stack e-commerce platform built with Node.js, Express.js, and MongoDB. It provides robust functionalities for both users and administrators, including secure authentication (local and Google OAuth), product browsing, shopping cart management, wishlist, checkout, order processing, and payment integration via Razorpay. Administrators can manage products, coupons, and generate sales reports. The application leverages EJS for dynamic templating and Tailwind CSS for a modern, responsive user interface.

## System Architecture

The application follows a modular architecture, separating concerns into distinct directories and files:

*   **`index.js`**: The application's entry point, responsible for initializing the Express server, connecting to MongoDB, configuring middleware (session management, Passport.js for authentication, flash messages, static file serving), setting up the EJS view engine, and mounting all primary API routes. It also includes global error handling.
*   **`config/`**: Contains configuration files, notably `db.js` for MongoDB connection and `passport.js` for Passport.js authentication strategies (local and Google OAuth).
*   **`models/`**: Defines Mongoose schemas for the application's data entities, such as `User`, `Product`, `Order`, `Cart`, `Wishlist`, and `Coupon`.
*   **`routers/`**: Organizes API endpoints into distinct modules for better maintainability. This includes dedicated routers for user-facing features (`userRouter`, `userAccount`, `userCart`, `userWishlist`, `userCheckout`, `userOrders`, `userCoupon`, `payment`) and administrative functionalities (`adminRouter`, `adminOrders`, `admin-coupon-management`, `adminSalesReportRouter`).
*   **`controllers/`**: Houses the business logic and request handlers for each route, interacting with models and services to process data and prepare responses.
*   **`middlewares/`**: Contains custom Express middleware functions, such as `errorHandler` for centralized error management and `showSearchbar` for conditional UI element visibility.
*   **`helpers/`**: Provides utility functions and helper modules, including the `error-handler-middleware` for consistent error responses.
*   **`views/`**: Stores EJS templates categorized into `user`, `admin`, and `partials` directories, facilitating dynamic rendering of HTML pages.
*   **`public/`**: Serves static assets like stylesheets, client-side JavaScript, and images.
*   **`logs/`**: (Implied by `winston` dependency) Directory for storing application logs.
*   **`package.json`**: Manages project dependencies, defines scripts for development and production, and specifies project metadata.
*   **`.env.example`**: A template file outlining the required environment variables for application configuration.

## Prerequisites

Before running this project, ensure you have the following installed:

*   **Node.js**: Version 18 or higher. Download and install from [nodejs.org](https://nodejs.org/).
*   **npm (Node Package Manager)**: Usually comes bundled with Node.js.
*   **MongoDB**: An active MongoDB instance (local or cloud-hosted via MongoDB Atlas).

## Installation

Follow these steps to set up the project locally:

```bash
# 1. Clone the repository
git clone https://github.com/Anvarsha-1/Giftora-EcomApp.git
cd Giftora-EcomApp

# 2. Install dependencies
npm install

# 3. Create a .env file based on .env.example
#    Populate with your database URI, session secret, API keys (e.g., Cloudinary, Razorpay, Google OAuth), etc.
cp .env.example .env
```

## Usage

To start the application, execute the following command:

```bash
# 1. Start the development server
npm run dev
# Or for a production-like environment (without nodemon)
# npm start
```
The application will be accessible in your web browser at `http://localhost:3000` (or the port specified in your `.env` file).

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

Please ensure code quality and proper documentation before submitting changes.

<br/><br/>_Generated by [Auto-README](https://auto-readme-livid.vercel.app/)_
