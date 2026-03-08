module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // PostgreSQL specific syntax for adding a value to an ENUM
            await queryInterface.sequelize.query(`
                ALTER TYPE "enum_sample_entries_lot_selection_decision" ADD VALUE IF NOT EXISTS 'SOLDOUT';
            `);
            console.log("Successfully added SOLDOUT to lot_selection_decision enum.");
        } catch (error) {
            if (error.message.includes("already exists")) {
                console.log("SOLDOUT already exists in enum_sample_entries_lot_selection_decision");
            } else {
                throw error;
            }
        }
    },

    down: async (queryInterface, Sequelize) => {
        console.log("Reverting ENUM additions requires manual type recreation. Skipping down for SOLDOUT.");
    }
};
