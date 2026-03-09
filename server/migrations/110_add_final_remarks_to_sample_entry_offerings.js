module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'sample_entry_offerings';
    const schema = await queryInterface.describeTable(table);

    if (!schema.final_remarks) {
      await queryInterface.addColumn(table, 'final_remarks', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = 'sample_entry_offerings';
    const schema = await queryInterface.describeTable(table);

    if (schema.final_remarks) {
      await queryInterface.removeColumn(table, 'final_remarks');
    }
  }
};
