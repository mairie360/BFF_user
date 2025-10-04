import express from 'express';
import healthRouter from './routes/health';
import dotenv from 'dotenv';
import usersRouter from './routes/getUsers';
import createUserRouter from './routes/createUser';
import updateUserRouter from './routes/updateUser';
import deleteUserRouter from './routes/deleteUser';

dotenv.config();

const app = express();

const PORT = process.env.PORT;

if (!PORT) {
  console.error('Error: PORT environment variable is not set.');
  process.exit(1);
}

app.use('/health', healthRouter);

/**
 * Get methods for users
 */
app.use('/users', usersRouter);

/**
 * Post methods for users
 */
app.use('/users', createUserRouter);

/**
 * Put methods for users
 */
app.use('/users', updateUserRouter);

/**
 * Delete methods for users
 */
app.use('/users', deleteUserRouter);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
