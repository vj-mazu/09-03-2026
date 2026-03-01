const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const StatusManagementService = require('../services/StatusManagementService');

const router = express.Router();

// Get status for a specific entry
router.get('/:entryType/:entryId', auth, async (req, res) => {
    try {
        const { entryType, entryId } = req.params;

        const status = await StatusManagementService.getStatus(
            Number.parseInt(entryId),
            entryType
        );

        if (!status) {
            return res.json({
                success: true,
                data: {
                    entryId: Number.parseInt(entryId),
                    entryType,
                    status: 'pending', // Default status
                    lastUpdated: null
                }
            });
        }

        res.json({
            success: true,
            data: {
                entryId: status.entry_id,
                entryType: status.entry_type,
                status: status.status,
                lastUpdated: status.last_updated,
                modifiedBy: status.modified_by,
                metadata: status.metadata
            }
        });
    } catch (error) {
        console.error('❌ Error getting entry status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get entry status',
            errorCode: 'STATUS_GET_ERROR'
        });
    }
});

// Update status for a specific entry
router.post('/:entryType/:entryId', auth, async (req, res) => {
    try {
        const { entryType, entryId } = req.params;
        const { status, metadata } = req.body;
        const userId = req.user?.id;

        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Status is required',
                errorCode: 'MISSING_STATUS'
            });
        }

        const updatedStatus = await StatusManagementService.updateStatus(
            Number.parseInt(entryId),
            entryType,
            status,
            userId,
            metadata
        );

        res.json({
            success: true,
            data: {
                entryId: updatedStatus.entry_id,
                entryType: updatedStatus.entry_type,
                status: updatedStatus.status,
                lastUpdated: updatedStatus.last_updated,
                modifiedBy: updatedStatus.modified_by,
                metadata: updatedStatus.metadata
            }
        });
    } catch (error) {
        console.error('❌ Error updating entry status:', error);

        let errorMessage = 'Failed to update entry status';
        let errorCode = 'STATUS_UPDATE_ERROR';

        if (error.message.includes('Invalid status')) {
            errorMessage = error.message;
            errorCode = 'INVALID_STATUS';
        } else if (error.message.includes('Invalid entry type')) {
            errorMessage = error.message;
            errorCode = 'INVALID_ENTRY_TYPE';
        }

        res.status(400).json({
            success: false,
            error: errorMessage,
            errorCode
        });
    }
});

// Get statuses for multiple entries (batch)
router.post('/batch/get', auth, async (req, res) => {
    try {
        const { entries } = req.body;

        if (!entries || !Array.isArray(entries)) {
            return res.status(400).json({
                success: false,
                error: 'Entries array is required',
                errorCode: 'MISSING_ENTRIES'
            });
        }

        const statuses = await StatusManagementService.getBatchStatuses(entries);

        // Create a map for quick lookup
        const statusMap = {};
        statuses.forEach(status => {
            const key = `${status.entry_type}_${status.entry_id}`;
            statusMap[key] = {
                entryId: status.entry_id,
                entryType: status.entry_type,
                status: status.status,
                lastUpdated: status.last_updated,
                modifiedBy: status.modified_by,
                metadata: status.metadata
            };
        });

        // Fill in missing entries with default status
        const result = entries.map(entry => {
            const key = `${entry.entryType}_${entry.entryId}`;
            return statusMap[key] || {
                entryId: entry.entryId,
                entryType: entry.entryType,
                status: 'pending',
                lastUpdated: null,
                modifiedBy: null,
                metadata: null
            };
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error getting batch statuses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get batch statuses',
            errorCode: 'BATCH_STATUS_GET_ERROR'
        });
    }
});

// Update statuses for multiple entries (batch)
router.post('/batch/update', auth, async (req, res) => {
    try {
        const { updates } = req.body;
        const userId = req.user?.id;

        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({
                success: false,
                error: 'Updates array is required',
                errorCode: 'MISSING_UPDATES'
            });
        }

        const updatedStatuses = await StatusManagementService.updateBatchStatuses(updates, userId);

        const result = updatedStatuses.map(status => ({
            entryId: status.entry_id,
            entryType: status.entry_type,
            status: status.status,
            lastUpdated: status.last_updated,
            modifiedBy: status.modified_by,
            metadata: status.metadata
        }));

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error updating batch statuses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update batch statuses',
            errorCode: 'BATCH_STATUS_UPDATE_ERROR'
        });
    }
});

// Get entries by status
router.get('/by-status/:status', auth, async (req, res) => {
    try {
        const { status } = req.params;
        const { entryType } = req.query;

        const entries = await StatusManagementService.getEntriesByStatus(status, entryType);

        const result = entries.map(entry => ({
            entryId: entry.entry_id,
            entryType: entry.entry_type,
            status: entry.status,
            lastUpdated: entry.last_updated,
            modifiedBy: entry.modified_by,
            metadata: entry.metadata
        }));

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error getting entries by status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get entries by status',
            errorCode: 'STATUS_FILTER_ERROR'
        });
    }
});

// Get status summary statistics
router.get('/summary', auth, async (req, res) => {
    try {
        const { entryType } = req.query;

        const summary = await StatusManagementService.getStatusSummary(entryType);

        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('❌ Error getting status summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get status summary',
            errorCode: 'STATUS_SUMMARY_ERROR'
        });
    }
});

// Delete status for an entry
router.delete('/:entryType/:entryId', auth, async (req, res) => {
    try {
        const { entryType, entryId } = req.params;

        const deleted = await StatusManagementService.deleteStatus(
            Number.parseInt(entryId),
            entryType
        );

        res.json({
            success: true,
            data: {
                deleted,
                entryId: Number.parseInt(entryId),
                entryType
            }
        });
    } catch (error) {
        console.error('❌ Error deleting entry status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete entry status',
            errorCode: 'STATUS_DELETE_ERROR'
        });
    }
});

// Cleanup old statuses (admin only)
router.post('/cleanup', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required',
                errorCode: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        const { daysOld = 90, status } = req.body;

        const deletedCount = await StatusManagementService.cleanupOldStatuses(daysOld, status);

        res.json({
            success: true,
            data: {
                deletedCount,
                daysOld,
                status: status || 'all'
            }
        });
    } catch (error) {
        console.error('❌ Error cleaning up statuses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup old statuses',
            errorCode: 'STATUS_CLEANUP_ERROR'
        });
    }
});

module.exports = router;