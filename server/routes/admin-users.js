const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/admin/users
 * Get all users (admin only)
 */
router.get('/users', auth, authorize('admin'), async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'role', 'isActive', 'createdAt', 'updatedAt'],
            order: [['role', 'ASC'], ['username', 'ASC']]
        });

        res.json({
            success: true,
            users: users.map(user => ({
                id: user.id,
                username: user.username,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }))
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * GET /api/admin/physical-supervisors
 * Get all physical supervisors (manager and admin can access)
 */
router.get('/physical-supervisors', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const supervisors = await User.findAll({
            where: { 
                role: 'physical_supervisor',
                isActive: true 
            },
            attributes: ['id', 'username'],
            order: [['username', 'ASC']]
        });

        res.json({
            success: true,
            users: supervisors.map(user => ({
                id: user.id,
                username: user.username,
                fullName: user.username // Use username as fullName since fullName field doesn't exist
            }))
        });
    } catch (error) {
        console.error('Get physical supervisors error:', error);
        res.status(500).json({ error: 'Failed to fetch physical supervisors' });
    }
});

/**
 * POST /api/admin/users
 * Create a new user (admin only)
 */
router.post('/users', auth, authorize('admin'), async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // Validation
        if (!username || !password || !role) {
            return res.status(400).json({ error: 'Username, password, and role are required' });
        }

        const validRoles = ['staff', 'manager', 'admin', 'quality_supervisor', 'physical_supervisor', 'inventory_staff', 'financial_account'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be one of: staff, manager, admin, quality_supervisor, physical_supervisor, inventory_staff, financial_account' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Password complexity check
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
        }

        // Check if username already exists
        const existingUser = await User.findOne({
            where: { username: username.toLowerCase() }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await User.create({
            username: username.toLowerCase(),
            password: hashedPassword,
            role: role,
            isActive: true
        });

        console.log(`✅ Admin ${req.user.username} created new user: ${newUser.username} (${role})`);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                role: newUser.role,
                isActive: newUser.isActive
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * PUT /api/admin/users/:id/credentials
 * Update username and/or password for a user (admin only)
 * Does NOT require last password - admin privilege
 */
router.put('/users/:id/credentials', auth, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password } = req.body;

        // Find user
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prepare update object
        const updates = {};

        // Update username if provided
        if (username && username.trim() !== '') {
            const normalizedUsername = username.toLowerCase().trim();

            // Check if username already exists (for different user)
            const existingUser = await User.findOne({
                where: {
                    username: normalizedUsername,
                    id: { [Op.ne]: id }
                }
            });

            if (existingUser) {
                return res.status(400).json({ error: 'Username already exists' });
            }

            updates.username = normalizedUsername;
        }

        // Update password if provided
        if (password && password.trim() !== '') {
            if (password.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters' });
            }

            // Password complexity check
            if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
                return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
            }

            // Hash new password with bcrypt
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.password = hashedPassword;
        }

        // Check if there are any updates
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        // Apply updates
        await user.update(updates);

        console.log(`✅ Admin ${req.user.username} updated credentials for user: ${user.username} (ID: ${id})`);

        res.json({
            success: true,
            message: 'User credentials updated successfully',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('Update credentials error:', error);
        res.status(500).json({ error: 'Failed to update user credentials' });
    }
});

/**
 * PUT /api/admin/users/:id/status
 * Activate or deactivate a user (admin only)
 */
router.put('/users/:id/status', auth, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        // Prevent admin from deactivating themselves
        if (parseInt(id) === req.user.userId && isActive === false) {
            return res.status(400).json({ error: 'You cannot deactivate your own account' });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await user.update({ isActive: !!isActive });

        console.log(`✅ Admin ${req.user.username} ${isActive ? 'activated' : 'deactivated'} user: ${user.username} (ID: ${id})`);

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

/**
 * PUT /api/admin/users/:id/role
 * Change user role (admin only)
 */
router.put('/users/:id/role', auth, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        // Prevent admin from changing their own role
        if (parseInt(id) === req.user.userId) {
            return res.status(400).json({ error: 'You cannot change your own role' });
        }

        const validRoles = ['staff', 'manager', 'admin', 'quality_supervisor', 'physical_supervisor', 'inventory_staff', 'financial_account'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be one of: staff, manager, admin, quality_supervisor, physical_supervisor, inventory_staff, financial_account' });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await user.update({ role });

        console.log(`✅ Admin ${req.user.username} changed role for user: ${user.username} to ${role}`);

        res.json({
            success: true,
            message: 'User role updated successfully',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user permanently (admin only)
 */
router.delete('/users/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent admin from deleting themselves
        if (parseInt(id) === req.user.userId) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const deletedUsername = user.username;
        await user.destroy();

        console.log(`✅ Admin ${req.user.username} deleted user: ${deletedUsername} (ID: ${id})`);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;
