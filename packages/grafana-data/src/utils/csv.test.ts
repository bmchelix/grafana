// Test with local CSV files
import fs from 'fs';

import { MutableDataFrame } from '../dataframe/MutableDataFrame';
import { getDataFrameRow, toDataFrameDTO } from '../dataframe/processDataFrame';
import { getDisplayProcessor } from '../field/displayProcessor';
import { createTheme } from '../themes/createTheme';
import { FieldType } from '../types/dataFrame';

import { CSVHeaderStyle, readCSV, toCSV } from './csv';

describe('read csv', () => {
  it('should get X and y', () => {
    const text = ',1\n2,3,4\n5,6\n,,,7';
    const data = readCSV(text);
    expect(data.length).toBe(1);

    const series = data[0];
    expect(series.fields.length).toBe(4);

    const rows = 4;
    expect(series.length).toBe(rows);

    // Make sure everything is padded properly
    for (const field of series.fields) {
      expect(field.values.length).toBe(rows);
    }

    const dto = toDataFrameDTO(series);
    expect(dto).toMatchSnapshot();
  });

  it('should read single string OK', () => {
    const text = 'a,b,c';
    const data = readCSV(text);
    expect(data.length).toBe(1);

    const series = data[0];
    expect(series.fields.length).toBe(3);
    expect(series.length).toBe(0);

    expect(series.fields[0].name).toEqual('a');
    expect(series.fields[1].name).toEqual('b');
    expect(series.fields[2].name).toEqual('c');
  });

  it('should read csv from local file system', () => {
    const path = __dirname + '/testdata/simple.csv';
    expect(fs.existsSync(path)).toBeTruthy();

    const csv = fs.readFileSync(path, 'utf8');
    const data = readCSV(csv);
    expect(data.length).toBe(1);
    expect(toDataFrameDTO(data[0])).toMatchSnapshot();
  });

  it('should read csv with headers', () => {
    const path = __dirname + '/testdata/withHeaders.csv';
    expect(fs.existsSync(path)).toBeTruthy();

    const csv = fs.readFileSync(path, 'utf8');
    const data = readCSV(csv);
    expect(data.length).toBe(1);
    expect(toDataFrameDTO(data[0])).toMatchSnapshot();
  });
});

function norm(csv: string): string {
  return csv.trim().replace(/[\r]/g, '');
}

describe('write csv', () => {
  it('should write the same CSV that we read', () => {
    const firstRow = [10, 'this "has quotes" inside', true];
    const path = __dirname + '/testdata/roundtrip.csv';
    const csv = fs.readFileSync(path, 'utf8');
    const data = readCSV(csv);
    const out = toCSV(data, { headerStyle: CSVHeaderStyle.full });
    expect(data.length).toBe(1);
    expect(getDataFrameRow(data[0], 0)).toEqual(firstRow);
    expect(data[0].fields.length).toBe(3);
    expect(norm(out)).toBe(norm(csv));

    // Keep the name even without special formatting
    const again = readCSV(out);
    const shorter = toCSV(again, { headerStyle: CSVHeaderStyle.name });

    const f = readCSV(shorter);
    const fields = f[0].fields;
    expect(fields.length).toBe(3);
    expect(getDataFrameRow(f[0], 0)).toEqual(firstRow);
    expect(fields.map((f) => f.name).join(',')).toEqual('a,b,c'); // the names
  });

  it('should add Excel header given config', () => {
    const dataFrame = new MutableDataFrame({
      fields: [
        { name: 'Time', values: [1598784913123, 1598784914123] },
        { name: 'Value', values: ['1234', '5678'] },
      ],
    });

    const csv = toCSV([dataFrame], { useExcelHeader: true });
    expect(csv).toMatchInlineSnapshot(`
      "sep=,
      "Time","Value"
      1598784913123,1234
      1598784914123,5678"
    `);
  });
});

describe('DataFrame to CSV', () => {
  it('should escape double quotes in the field names', () => {
    const dataFrame = new MutableDataFrame({
      fields: [
        { name: 'Time', values: [1589455688623] },
        // As we have traceId in message already this will shadow it.
        {
          name: 'Value',
          values: ['1234'],
          labels: {
            label1: 'value1',
            label2: 'value1',
          },
        },
      ],
    });

    const csv = toCSV([dataFrame]);
    expect(csv).toMatchInlineSnapshot(`
      ""Time","{label1=""value1"", label2=""value1""}"
      1589455688623,1234"
    `);
  });

  it('should use field display processor if exists', () => {
    const dataFrame = new MutableDataFrame({
      fields: [
        { name: 'Time', values: [1589455688623] },
        {
          name: 'Value',
          values: [1589455688623],
          config: {
            unit: 'dateTimeAsIso',
          },
        },
      ],
    });

    dataFrame.fields[1].display = getDisplayProcessor({
      field: dataFrame.fields[1],
      timeZone: 'utc',
      theme: createTheme(),
    });

    const csv = toCSV([dataFrame]);
    expect(csv).toMatchInlineSnapshot(`
      ""Time","Value"
      1589455688623,2020-05-14 11:28:08"
    `);
  });

  it('should handle field type frame', () => {
    const dataFrame = new MutableDataFrame({
      fields: [
        { name: 'Time', values: [1589455688623, 1589455692345] },
        {
          name: 'Value',
          type: FieldType.frame,
          values: [{ value: '1234' }, { value: '0' }],
        },
      ],
    });

    const csv = toCSV([dataFrame]);
    expect(csv).toMatchInlineSnapshot(`
      ""Time","Value"
      1589455688623,1234
      1589455692345,0"
    `);
  });

  it('should handle null values', () => {
    const dataFrame = new MutableDataFrame({
      fields: [
        { name: 'Time', values: [1589455688623] },
        {
          name: 'Value',
          type: FieldType.other,
          values: [null],
        },
      ],
    });

    const csv = toCSV([dataFrame]);
    expect(csv).toMatchInlineSnapshot(`
      ""Time","Value"
      1589455688623,"
    `);
  });

  it('should export footer reducers from defaults and overrides together', () => {
    const dataFrame = new MutableDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1767225960000, 1767225960000, 1767225960000],
          config: { unit: 'dateTimeAsIso', custom: {} },
        },
        { name: 'string', values: ['alpha', 'beta', 'epsilon'], config: { custom: {} } },
        { name: 'number', values: [1, 2, 5], config: { custom: {} } },
      ],
    });

    dataFrame.fields[0].display = getDisplayProcessor({
      field: dataFrame.fields[0],
      timeZone: 'utc',
      theme: createTheme(),
    });

    (window as any).grafanaBootData = { settings: { csvDelimiters: [','] } };
    (window as any).grafanaRuntime = {
      getPanels: () => [
        {
          id: 19,
          fieldConfig: {
            defaults: {
              custom: {
                footer: {
                  reducers: ['firstNotNull', 'lastNotNull', 'countAll'],
                },
              },
            },
            overrides: [
              {
                matcher: { id: 'byName', options: 'number' },
                properties: [{ id: 'custom.footer.reducers', value: ['max', 'sum'] }],
              },
              {
                matcher: { id: 'byName', options: 'string' },
                properties: [{ id: 'custom.footer.reducers', value: ['lastNotNull', 'last'] }],
              },
            ],
          },
        },
      ],
    };

    const csv = toCSV([dataFrame], {
      headerStyle: CSVHeaderStyle.name,
      enableOverrides: true,
      panelId: 19,
      newline: '\n',
    });

    const lines = csv.trim().split('\n');
    const footerLines = lines.slice(-3);

    expect(footerLines).toHaveLength(3);
    expect(footerLines[0]).toContain('First');
    expect(footerLines[0]).toContain('Last *   epsilon[@meta@]f=1');
    expect(footerLines[0]).toContain('Max   5[@meta@]f=1');

    expect(footerLines[1]).toContain('Last');
    expect(footerLines[1]).toContain('Last   epsilon[@meta@]f=1');
    expect(footerLines[1]).toContain('Total   8[@meta@]f=1');

    expect(footerLines[2]).toMatch(/Count(\sall)?/i);
    expect(footerLines[2]).toContain('3[@meta@]f=1');

    expect(csv).not.toContain('Max[@meta@]f=1, [@meta@]f=1,5[@meta@]f=1');
    expect(csv).not.toContain('Total[@meta@]f=1, [@meta@]f=1,8[@meta@]f=1');
  });

  it('should keep countAll footer value numeric for first visible time field', () => {
    const dataFrame = new MutableDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1767225960000, 1767225960000, 1767225960000],
          config: { unit: 'dateTimeAsIso', custom: {} },
        },
        { name: 'string', values: ['alpha', 'beta', 'epsilon'], config: { custom: {} } },
        { name: 'number', values: [1, 2, 5], config: { custom: {} } },
      ],
    });

    dataFrame.fields[0].display = getDisplayProcessor({
      field: dataFrame.fields[0],
      timeZone: 'utc',
      theme: createTheme(),
    });

    (window as any).grafanaBootData = { settings: { csvDelimiters: [','] } };
    (window as any).grafanaRuntime = {
      getPanels: () => [
        {
          id: 19,
          fieldConfig: {
            defaults: {
              custom: {
                footer: {
                  reducers: ['countAll'],
                },
              },
            },
            overrides: [],
          },
        },
      ],
    };

    const csv = toCSV([dataFrame], {
      headerStyle: CSVHeaderStyle.name,
      enableOverrides: true,
      panelId: 19,
      newline: '\n',
    });

    expect(csv).toContain('3[@meta@]f=1');
    expect(csv).not.toMatch(/1970-01-01|1970|05:30:00\.003/);
  });

  it('should show reducer label only in first value column when reducer is same across columns', () => {
    const dataFrame = new MutableDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1767225960000, 1767225960000, 1767225960000],
          config: { unit: 'dateTimeAsIso', custom: {} },
        },
        { name: 'string', values: ['alpha', 'beta', 'epsilon'], config: { custom: {} } },
        { name: 'number', values: [1, 2, 5], config: { custom: {} } },
      ],
    });

    dataFrame.fields[0].display = getDisplayProcessor({
      field: dataFrame.fields[0],
      timeZone: 'utc',
      theme: createTheme(),
    });

    (window as any).grafanaBootData = { settings: { csvDelimiters: [','] } };
    (window as any).grafanaRuntime = {
      getPanels: () => [
        {
          id: 21,
          fieldConfig: {
            defaults: {
              custom: {
                footer: {
                  reducers: ['lastNotNull'],
                },
              },
            },
            overrides: [],
          },
        },
      ],
    };

    const csv = toCSV([dataFrame], {
      headerStyle: CSVHeaderStyle.name,
      enableOverrides: true,
      panelId: 21,
      newline: '\n',
    });

    const footerLine = csv.trim().split('\n').at(-1) || '';
    expect(footerLine).toContain('Last *   2026');
    expect(footerLine).toContain(',epsilon[@meta@]f=1,5[@meta@]f=1');
    expect(footerLine).not.toContain('Last *   epsilon');
    expect(footerLine).not.toContain('Last *   5');
  });

  it('should not print reducer label when first visible column has no footer value', () => {
    const dataFrame = new MutableDataFrame({
      fields: [
        { name: 'string', values: ['alpha', 'beta', 'epsilon'], config: { custom: {} } },
        { name: 'number', values: [1, 2, 5], config: { custom: {} } },
        { name: 'time', type: FieldType.time, values: [1767225960000, 1767225960000, 1767225960000], config: { custom: {} } },
      ],
    });

    (window as any).grafanaBootData = { settings: { csvDelimiters: [','] } };
    (window as any).grafanaRuntime = {
      getPanels: () => [
        {
          id: 22,
          fieldConfig: {
            defaults: {
              custom: {
                footer: {
                  reducers: ['min'],
                },
              },
            },
            overrides: [],
          },
        },
      ],
    };

    const csv = toCSV([dataFrame], {
      headerStyle: CSVHeaderStyle.name,
      enableOverrides: true,
      panelId: 22,
      newline: '\n',
    });

    const footerLine = csv.trim().split('\n').at(-1) || '';
    expect(footerLine).toContain('Min   1[@meta@]f=1');
    expect(footerLine).not.toContain('Min[@meta@]f=1,');
  });
});
