interface TableConfig {
  order: string[];
  displayNames: { [key: string]: string };
}

interface Config {
  tables: TableConfig;
}

const config: Config = {
  tables: {
    order: [
      'democracy',
      'legal_framework_human_dignity',
      'legal_framework_freedom',
      'legal_framework_pluralism',
      'legal_framework_equality',
      'legal_framework_rule_of_law',
      'supply_side',
      'demand_side_media_use',
      'demand_side_trust_in_media',
      'basic_data',
    ],
    displayNames: {
      demand_side_trust_in_media: "Demand Side: Trust in Media",
      basic_data: "Basic Data",
      demand_side_media_use: "Demand Side: Media Use",
      democracy: "Democracy & Participation",
      legal_framework_equality: "Legal Framework: Equality",
      legal_framework_freedom: "Legal Framework: Freedom",
      legal_framework_human_dignity: "Legal Framework: Human Dignity",
      legal_framework_pluralism: "Legal Framework: Pluralism",
      legal_framework_rule_of_law: "Legal Framework: Rule of Law",
      supply_side: "Supply Side"
    }
  }
};

export function getTableOrder(): string[] {
  // Filter out internal/metadata tables that shouldn't be displayed
  return config.tables.order.filter(table => table !== 'basic_data');
}

export function getTableDisplayName(tableName: string): string {
  return config.tables.displayNames[tableName] || tableName;
}

export default config;