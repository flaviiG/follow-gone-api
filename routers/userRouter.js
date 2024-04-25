const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signUp);
router.post('/login', authController.login);

router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);
router.patch('/updatePassword', authController.protect, authController.updatePassword);

router.patch('/updateMe', authController.protect, userController.updateMe);
router.patch('/unfollowers', authController.protect, userController.updateUnfollowers);

router.delete('/deleteMe', authController.protect, userController.deleteMe);

router.get('/getUser', authController.protect, userController.getUser);
router.get('/getFollowers', authController.protect, userController.getFollowersList);
router.get('/unfollowers', authController.protect, userController.getUnfollowList);

router
  .route('/')
  .get(authController.protect, userController.getAllUsers)
  .post(userController.createUser);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
