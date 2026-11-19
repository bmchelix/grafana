import { Permission, PermissionGroup } from './types';

const groupNameCollator = new Intl.Collator();

export const rawToPermissionGroup = (permissions: Permission[]): PermissionGroup => {
  const weight = [
    'Dashboards',
    'Folders',
    'Datasources',
    'Calculated fields',
    'Reports',
    'Administration',
    'Service management query types',
    'Insight Finder',
  ];

  // removed a {} as PermissionGroup type assertion (it surfaced as an additional lint error) by rewriting that grouping block without assertions. Added to pass linting check.
  const group: PermissionGroup = {};
  permissions.forEach((curr: Permission) => {
    if (!group[curr.group]) {
      group[curr.group] = [];
    }
    group[curr.group].push(curr);
  });

  // sort the keys based on the order
  const ordered: PermissionGroup = {};
  weight.forEach((key) => {
    if (group[key]) {
      ordered[key] = group[key];
    }
  });
  // Keep known groups in the desired order, but do not drop newly added groups.
  //any unknown/new groups are now appended alphabetically instead of being discarded.
  Object.keys(group)
    .filter((key) => !weight.includes(key))
    .sort((a, b) => groupNameCollator.compare(a, b))
    .forEach((key) => {
      ordered[key] = group[key];
    });
  return ordered;
};

export const orderPermissions = (permissions: Permission[]): Permission[] => {
  const weight = [':access', ':read', ':create', ':download'];

  return permissions.sort((a, b) => {
    const aWeight = weight.findIndex((w) => a.name.includes(w));
    const bWeight = weight.findIndex((w) => b.name.includes(w));

    if (aWeight === -1 && bWeight === -1) {
      // eslint-disable-next-line no-restricted-syntax
      return a.name.localeCompare(b.name);
    }

    if (aWeight === -1) {
      return 1;
    }

    if (bWeight === -1) {
      return -1;
    }

    return aWeight - bWeight;
  });
};
