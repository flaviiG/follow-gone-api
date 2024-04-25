const User = require('../models/userModel');
const AppError = require('../utils/appError');
// const features = require("../utils/apiFeatures");
const catchAsync = require('../utils/catchAsync');
const puppeteerBrowser = require('../puppeteerBrowser');

function filterObj(obj, ...allowedFields) {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
}

exports.getAllUsers = catchAsync(async (req, res) => {
  const tours = await User.find();

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      tours,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});

exports.updateUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined',
  });
};

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined',
  });
};

exports.deleteUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined',
  });
};

exports.deleteMe = catchAsync(async (req, res, next) => {
  console.log('Delete', req.user);
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  //1) Create error if user posts password data
  if (req.body.password || req.body.passwordConfirm)
    return next(new AppError("You cant't modify your password from here"));

  // 2) filtered out fields
  const filteredBody = filterObj(req.body, 'name', 'email');

  // 3) update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.getFollowersList = catchAsync(async (req, res, next) => {
  const followersList = await puppeteerBrowser.runPuppeteerScript(req.user.instagramUsername);

  await User.findByIdAndUpdate(req.user.id, { followerList: followersList });

  res.status(200).json({
    status: 'success',
    data: {
      followers: followersList,
    },
  });
});

exports.getUnfollowList = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      unfollowList: user.unfollowList,
    },
  });
});

exports.updateUnfollowers = catchAsync(async (req, res, next) => {
  const newUnfollowList = req.body.unfollowList;
  await User.findByIdAndUpdate(req.user.id, { unfollowList: newUnfollowList });

  res.status(200).json({
    status: 'success',
    data: {
      unfollowList: newUnfollowList,
    },
  });
});
