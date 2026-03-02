'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add bend2 column to physical_inspections table
        const tableInfo = await queryInterface.describeTable('physical_inspections');
        if (!tableInfo.bend2) {
            await queryInterface.addColumn('physical_inspections', 'bend2', {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: true,
                defaultValue: null
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('physical_inspections', 'bend2');
    }
};
