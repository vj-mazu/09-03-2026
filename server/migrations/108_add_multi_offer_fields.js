'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('sample_entry_offerings').catch(() => null);

        if (!tableInfo) {
            return;
        }

        const columnsToAdd = [
            {
                name: 'offer_versions',
                config: {
                    type: Sequelize.JSONB,
                    allowNull: true,
                    defaultValue: []
                }
            },
            {
                name: 'active_offer_key',
                config: {
                    type: Sequelize.STRING(20),
                    allowNull: true
                }
            },
            {
                name: 'cd_enabled',
                config: {
                    type: Sequelize.BOOLEAN,
                    allowNull: true,
                    defaultValue: false
                }
            },
            {
                name: 'cd_value',
                config: {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: true,
                    defaultValue: 0
                }
            },
            {
                name: 'cd_unit',
                config: {
                    type: Sequelize.STRING(20),
                    allowNull: true,
                    defaultValue: 'lumps'
                }
            },
            {
                name: 'bank_loan_enabled',
                config: {
                    type: Sequelize.BOOLEAN,
                    allowNull: true,
                    defaultValue: false
                }
            },
            {
                name: 'bank_loan_value',
                config: {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: true,
                    defaultValue: 0
                }
            },
            {
                name: 'bank_loan_unit',
                config: {
                    type: Sequelize.STRING(20),
                    allowNull: true,
                    defaultValue: 'lumps'
                }
            },
            {
                name: 'payment_condition_value',
                config: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: 15
                }
            },
            {
                name: 'payment_condition_unit',
                config: {
                    type: Sequelize.STRING(20),
                    allowNull: true,
                    defaultValue: 'days'
                }
            }
        ];

        for (const column of columnsToAdd) {
            if (!tableInfo[column.name]) {
                await queryInterface.addColumn('sample_entry_offerings', column.name, column.config);
            }
        }
    },

    down: async (queryInterface) => {
        const columnsToRemove = [
            'offer_versions',
            'active_offer_key',
            'cd_enabled',
            'cd_value',
            'cd_unit',
            'bank_loan_enabled',
            'bank_loan_value',
            'bank_loan_unit',
            'payment_condition_value',
            'payment_condition_unit'
        ];

        for (const column of columnsToRemove) {
            await queryInterface.removeColumn('sample_entry_offerings', column).catch(() => { });
        }
    }
};
