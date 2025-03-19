# OAuth2 Discord Bot (Warden Replacement)

This project is a Discord bot that integrates OAuth2 authentication and uses Prisma to interact with a MySQL database. It serves as a replacement for Warden with improvements in performance and scalability.

## Requirements

-   **Node.js** (version 20 or above)
-   **Prisma ORM** (for database management)
-   **MySQL** (used as the database)

## Installation

### Step 1: Clone the repository

Clone this repository to your local machine:

```bash
git clone https://github.com/niroteam/protector-source.git
cd protector-source
```

### Step 2: Install dependencies

Install the required dependencies using `npm`:

```bash
npm install
```

### Step 3: Set up your MySQL database

1. Set up a MySQL database (you can use services like AWS RDS, DigitalOcean, or a local MySQL server).
2. Put your credentials in the .env for your database
3. Rename .env.example to .env

### Step 4: Prisma setup

1. Install Prisma CLI:

```bash
npm install prisma --save-dev
```

2. Generate Prisma client:

```bash
npx prisma generate
```

3. Apply the Prisma schema to your MySQL database:

```bash
npx prisma migrate deploy
```

-   This will apply the migrations defined in `prisma/schema.prisma` to your MySQL database.

### Step 5: Config & Run the bot

Config is located in src/config.example.json
When you are done, rename file to config.json

---

Run the bot using the following command:

```bash
npm start
```

This will start the bot, and it will be ready to handle OAuth2 authentication and interactions with Discord.

## Usage

-   The bot will authenticate users using Discord's OAuth2 and store their information in the MySQL database using Prisma.
-   Use /setverify to set your verify data

### Prisma CLI Commands

-   **Prisma Generate**: `npx prisma generate` - Generates Prisma client after schema changes.
-   **Prisma Migrate**: `npx prisma migrate deploy` - Applies schema changes to the database.

## Contributing

If you'd like to contribute to this project, feel free to open an issue or a pull request.

---

Let me know if you'd like to add or modify anything in this!
