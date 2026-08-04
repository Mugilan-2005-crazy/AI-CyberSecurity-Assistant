/**
 * controllers/adminController.js
 * ------------------------------------------------------------
 * Admin features: user management, analytics, and system logs.
 * All routes are gated by protect + authorize('admin').
 */
import User from '../models/User.js';
import ScanHistory from '../models/ScanHistory.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';

export const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const filter = q ? { $or: [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }] } : {};
    const users = await User.find(filter)
      .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await User.countDocuments(filter);
    res.json({ success: true, users, total, page: Number(page) });
  } catch (err) { next(err); }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, 'User not found');
    if (role) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    await user.save();
    res.json({ success: true, message: 'User updated' });
  } catch (err) { next(err); }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { next(err); }
};

export const analytics = async (req, res, next) => {
  try {
    const [totalUsers, totalScans, scansByType, threats] = await Promise.all([
      User.countDocuments(),
      ScanHistory.countDocuments(),
      ScanHistory.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      ScanHistory.aggregate([{ $group: { _id: '$verdict', count: { $sum: 1 } } }]),
    ]);
    res.json({ success: true, data: { totalUsers, totalScans, scansByType, verdicts: threats } });
  } catch (err) { next(err); }
};

export const logs = async (req, res, next) => {
  try {
    const logs = await ScanHistory.find().sort({ createdAt: -1 }).limit(100).populate('user', 'email');
    res.json({ success: true, logs });
  } catch (err) { next(err); }
};

export const notifications = async (req, res, next) => {
  try {
    const notes = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50);
    res.json({
      success: true,
      notifications: notes.map((n) => ({
        _id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        category: n.category,
        severity: n.severity,
        metadata: n.metadata,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
    });
  } catch (err) { next(err); }
};

export default { listUsers, updateUser, deleteUser, analytics, logs, notifications };
