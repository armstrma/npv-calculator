import { getPeriodLabel, getPeriodMeta } from './calculation.js';

const TEMPLATE_PATH = '/templates/npv-lab-export-template.xlsx';
const TEMPLATE_CASHFLOW_PERIODS = 3;

const cloneStyle = (style = {}) => JSON.parse(JSON.stringify(style));

const columnLetter = (index) => {
  let letter = '';
  let value = index;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    value = Math.floor((value - 1) / 26);
  }

  return letter;
};

const safeFilePart = (value, fallback = 'npv-report') => {
  const sanitized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || fallback;
};

const setFormula = (cell, formula, result = undefined) => {
  cell.value = { formula, result };
};

const buildPaybackFormula = ({ periodCount, discounted = false }) => {
  const cumulativeRow = discounted ? 10 : 9;
  const recoveryRow = discounted ? 8 : 6;
  const clauses = [];

  for (let period = 1; period <= periodCount; period += 1) {
    const currentCol = columnLetter(2 + period);
    const previousCol = columnLetter(1 + period);
    const prefix = period === 1 ? '' : `${period - 1}+`;
    clauses.push(`IF(${currentCol}${cumulativeRow}>=0,${prefix}ABS(${previousCol}${cumulativeRow})/${currentCol}${recoveryRow},`);
  }

  return `${clauses.join('')}"N/A"${')'.repeat(periodCount)}`;
};

const writeAssumptions = (sheet, {
  initial,
  appliedDiscountRate,
  discount,
  rateBasis,
  periodMode,
  cashflows,
  sensitivityPercent,
}) => {
  const periodMeta = getPeriodMeta(periodMode);

  sheet.getCell('A2').value = `npvlab.com  ·  Export Date: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: '2-digit' })}  ·  DCF Model extends automatically through ${cashflows.length} ${periodMeta.label.toLowerCase()}`;
  sheet.getCell('B7').value = Number(initial) || 0;
  sheet.getCell('A8').value = `${rateBasis === 'annual' ? 'Applied' : 'Per-Period'} Discount Rate`;
  sheet.getCell('B8').value = (Number(appliedDiscountRate) || 0) / 100;
  sheet.getCell('C8').value = rateBasis === 'annual'
    ? `Converted from ${Number(discount || 0).toFixed(2)}% annual based on ${periodMeta.label.toLowerCase()}`
    : `Entered directly as ${periodMeta.appliedLabel} cash-flow rate`;
  sheet.getCell('B9').value = (Number(sensitivityPercent) || 0) / 100;

  const cashflowCount = Math.max(cashflows.length, TEMPLATE_CASHFLOW_PERIODS);
  for (let index = 0; index < cashflowCount; index += 1) {
    const rowNumber = 13 + index;
    const row = sheet.getRow(rowNumber);
    const templateRow = sheet.getRow(Math.min(rowNumber, 15));
    row.height = templateRow.height;

    ['A', 'B', 'C'].forEach((col) => {
      sheet.getCell(`${col}${rowNumber}`).style = cloneStyle(sheet.getCell(`${col}${Math.min(rowNumber, 15)}`).style);
    });

    if (index < cashflows.length) {
      sheet.getCell(`A${rowNumber}`).value = getPeriodLabel(periodMode, index + 1);
      sheet.getCell(`B${rowNumber}`).value = Number(cashflows[index]) || 0;
      sheet.getCell(`C${rowNumber}`).value = 'Operating cash flow';
    } else {
      sheet.getCell(`A${rowNumber}`).value = null;
      sheet.getCell(`B${rowNumber}`).value = null;
      sheet.getCell(`C${rowNumber}`).value = null;
    }
  }
};

const alignDcfColumns = (sheet, periodCount) => {
  const extraPeriods = periodCount - TEMPLATE_CASHFLOW_PERIODS;
  if (extraPeriods > 0) {
    sheet.spliceColumns(6, 0, ...Array.from({ length: extraPeriods }, () => []));
  } else if (extraPeriods < 0) {
    sheet.spliceColumns(3 + periodCount, Math.abs(extraPeriods));
  }
};

const writeDcfModel = (sheet, { periodMode, cashflows, npv, payback }) => {
  const periodCount = cashflows.length;
  const lastPeriodColIndex = 2 + periodCount;
  const lastPeriodCol = columnLetter(lastPeriodColIndex);
  const notesCol = columnLetter(lastPeriodColIndex + 1);
  const periodMeta = getPeriodMeta(periodMode);

  alignDcfColumns(sheet, periodCount);

  for (let colIndex = 3; colIndex <= lastPeriodColIndex; colIndex += 1) {
    const sourceCol = columnLetter(Math.min(colIndex, 5));
    const targetCol = columnLetter(colIndex);
    sheet.getColumn(colIndex).width = sheet.getColumn(Math.min(colIndex, 5)).width || 14;

    for (let row = 4; row <= 10; row += 1) {
      sheet.getCell(`${targetCol}${row}`).style = cloneStyle(sheet.getCell(`${sourceCol}${row}`).style);
    }
  }

  sheet.getColumn(lastPeriodColIndex + 1).width = 42;
  sheet.getCell('A2').value = `Dynamic export generated from NPV Lab  ·  Period mode: ${periodMeta.label}  ·  Last modeled period: ${getPeriodLabel(periodMode, periodCount)}`;
  sheet.getCell('B4').value = 'Initial';
  sheet.getCell('B5').value = 0;
  setFormula(sheet.getCell('B6'), '-Assumptions!B7');
  setFormula(sheet.getCell('B7'), '1');
  setFormula(sheet.getCell('B8'), 'B6*B7');
  setFormula(sheet.getCell('B9'), 'B6');
  setFormula(sheet.getCell('B10'), 'B8');

  for (let period = 1; period <= periodCount; period += 1) {
    const col = columnLetter(2 + period);
    const previousCol = columnLetter(1 + period);
    const assumptionRow = 12 + period;
    sheet.getCell(`${col}4`).value = getPeriodLabel(periodMode, period);
    sheet.getCell(`${col}5`).value = period;
    setFormula(sheet.getCell(`${col}6`), `Assumptions!B${assumptionRow}`);
    setFormula(sheet.getCell(`${col}7`), `1/(1+Assumptions!$B$8)^${col}5`);
    setFormula(sheet.getCell(`${col}8`), `${col}6*${col}7`);
    setFormula(sheet.getCell(`${col}9`), `${previousCol}9+${col}6`);
    setFormula(sheet.getCell(`${col}10`), `${previousCol}10+${col}8`);
  }

  sheet.getCell(`${notesCol}5`).value = 'Reference only — drives discount factor formula';
  sheet.getCell(`${notesCol}6`).value = 'Initial = negative outlay; later periods = projected cash flows';
  sheet.getCell(`${notesCol}7`).value = 'Formula: 1 / (1 + Discount Rate)^t';
  sheet.getCell(`${notesCol}8`).value = 'Cash Flow x Discount Factor';
  sheet.getCell(`${notesCol}9`).value = 'Running undiscounted total';
  sheet.getCell(`${notesCol}10`).value = 'Running discounted total';

  setFormula(sheet.getCell('B14'), `NPV(Assumptions!B8,C6:${lastPeriodCol}6)+B6`, npv);
  setFormula(sheet.getCell('B15'), `IRR(B6:${lastPeriodCol}6)`);
  setFormula(sheet.getCell('B16'), buildPaybackFormula({ periodCount }), payback);
  setFormula(sheet.getCell('B17'), buildPaybackFormula({ periodCount, discounted: true }));
  setFormula(sheet.getCell('B18'), 'B14/ABS(B6)');

  sheet.getCell('C14').value = `NPV(rate, CF1..CF${periodCount}) + Initial CF`;
  sheet.getCell('C15').value = `IRR(Initial CF : ${getPeriodLabel(periodMode, periodCount)} CF)`;
};

const writeDecisionAnalysis = (sheet, { periodCount, npv }) => {
  const stressedCashflowArgs = Array.from({ length: periodCount }, (_, index) => {
    const col = columnLetter(3 + index);
    return `'DCF Model'!${col}6*(1-Assumptions!B9)`;
  }).join(',');

  setFormula(sheet.getCell('B15'), "'DCF Model'!B14-Assumptions!B7*Assumptions!B9", npv);
  setFormula(sheet.getCell('B16'), `NPV(Assumptions!B8,${stressedCashflowArgs})+'DCF Model'!B6`);
};

const writeNpvCurve = (sheet, lastPeriodCol) => {
  for (let row = 5; row <= 25; row += 1) {
    setFormula(sheet.getCell(`B${row}`), `NPV(A${row},'DCF Model'!C6:'DCF Model'!${lastPeriodCol}6)+'DCF Model'!B6`);
  }
};

export const exportNpvWorkbook = async ({
  projectName,
  ...project
}) => {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) throw new Error('Unable to load the NPV Lab Excel template.');

  const buffer = await createNpvWorkbookBuffer({
    ...project,
    templateBuffer: await response.arrayBuffer(),
  });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilePart(projectName)}-npv-lab-export.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const createNpvWorkbookBuffer = async ({
  templateBuffer,
  ExcelJS,
  initial,
  discount,
  appliedDiscountRate,
  rateBasis,
  periodMode,
  cashflows,
  sensitivityPercent,
  npv,
  payback,
}) => {
  const ExcelLibrary = ExcelJS || (await import('exceljs')).default;
  const workbook = new ExcelLibrary.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const cleanCashflows = cashflows.length ? cashflows.map((value) => Number(value) || 0) : [0];
  const assumptionsSheet = workbook.getWorksheet('Assumptions');
  const dcfSheet = workbook.getWorksheet('DCF Model');
  const decisionSheet = workbook.getWorksheet('Decision Analysis');
  const curveSheet = workbook.getWorksheet('NPV Curve');

  if (!assumptionsSheet || !dcfSheet || !decisionSheet || !curveSheet) {
    throw new Error('The NPV Lab Excel template is missing a required worksheet.');
  }

  writeAssumptions(assumptionsSheet, {
    initial,
    appliedDiscountRate,
    discount,
    rateBasis,
    periodMode,
    cashflows: cleanCashflows,
    sensitivityPercent,
  });
  writeDcfModel(dcfSheet, { periodMode, cashflows: cleanCashflows, npv, payback });

  const lastPeriodCol = columnLetter(2 + cleanCashflows.length);
  writeDecisionAnalysis(decisionSheet, { periodCount: cleanCashflows.length, npv });
  writeNpvCurve(curveSheet, lastPeriodCol);

  workbook.creator = 'NPV Lab';
  workbook.created = new Date();
  workbook.modified = new Date();

  return workbook.xlsx.writeBuffer();
};
