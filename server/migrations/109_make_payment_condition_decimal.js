'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('sample_entry_offerings').catch(() => null);

    if (!tableInfo || !tableInfo.payment_condition_value) {
      return;
    }

    const currentType = String(tableInfo.payment_condition_value.type || '').toUpperCase();
    if (currentType.includes('DECIMAL') || currentType.includes('NUMERIC')) {
      return;
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE sample_entry_offerings
      ALTER COLUMN payment_condition_value TYPE DECIMAL(10, 2)
      USING payment_condition_value::DECIMAL(10, 2)
    `);
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('sample_entry_offerings').catch(() => null);

    if (!tableInfo || !tableInfo.payment_condition_value) {
      return;
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE sample_entry_offerings
      ALTER COLUMN payment_condition_value TYPE INTEGER
      USING ROUND(payment_condition_value)::INTEGER
    `);
  }
};
