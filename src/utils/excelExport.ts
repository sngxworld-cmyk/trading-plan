import * as XLSX from "xlsx";
import { TradingDataStore, DayRecord } from "../types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function getDaysInMonth(mIdx: number): number {
  return MONTH_DAYS[mIdx] || 30;
}

export function exportTradingPlanToExcel(
  tradingData: TradingDataStore,
  yearRange: string,
  userEmail: string,
  startMonth: number = 0
) {
  const yearData = tradingData[yearRange] || {};

  let totalWinDays = 0;
  let totalLossDays = 0;
  let totalNeutralDays = 0;
  let totalPnL = 0;
  let totalRoi = 0;

  const monthlyRows: any[] = [];
  const dailyRows: any[] = [];

  for (let m = 0; m < 12; m++) {
    const actualMonthIndex = (startMonth + m) % 12;
    const monthName = MONTH_NAMES[actualMonthIndex];
    const daysInMonth = getDaysInMonth(actualMonthIndex);
    const monthData = yearData[actualMonthIndex] || {};

    let mWins = 0;
    let mLosses = 0;
    let mNeutrals = 0;
    let mPnL = 0;
    let mRoi = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayRecord: DayRecord = monthData[d] || { state: "", amount: "", roi: "", notes: "" };
      const rawAmt = parseFloat(dayRecord.amount) || 0;
      const rawRoi = parseFloat(dayRecord.roi) || 0;

      let status = "Not Logged";
      let netAmt = 0;
      let netRoi = 0;

      if (dayRecord.state === "green") {
        status = "Win (Profit)";
        mWins++;
        totalWinDays++;
        netAmt = rawAmt;
        netRoi = rawRoi;
      } else if (dayRecord.state === "red") {
        status = "Loss";
        mLosses++;
        totalLossDays++;
        netAmt = -rawAmt;
        netRoi = -rawRoi;
      } else if (dayRecord.state === "neutral" || dayRecord.amount || dayRecord.roi) {
        status = "Neutral / Break-even";
        mNeutrals++;
        totalNeutralDays++;
      } else {
        mNeutrals++;
      }

      mPnL += netAmt;
      mRoi += netRoi;

      if (dayRecord.state || dayRecord.amount || dayRecord.roi || dayRecord.notes) {
        dailyRows.push({
          "Month": monthName,
          "Day Number": `Day ${d}`,
          "Result Status": status,
          "Daily Net PnL ($)": netAmt,
          "Daily ROI (%)": `${netRoi >= 0 ? "+" : ""}${netRoi.toFixed(2)}%`,
          "Strategy Notes / Setups": dayRecord.notes || "",
        });
      }
    }

    totalPnL += mPnL;
    totalRoi += mRoi;

    const recordedDays = mWins + mLosses;
    const winRate = recordedDays > 0 ? ((mWins / recordedDays) * 100).toFixed(1) + "%" : "0.0%";

    monthlyRows.push({
      "Month Name": monthName,
      "Total Month Days": daysInMonth,
      "Winning Days": mWins,
      "Losing Days": mLosses,
      "Win Rate (%)": winRate,
      "Monthly Net PnL ($)": mPnL,
      "Monthly ROI (%)": `${mRoi >= 0 ? "+" : ""}${mRoi.toFixed(2)}%`,
    });
  }

  const recordedTotalDays = totalWinDays + totalLossDays;
  const overallWinRate =
    recordedTotalDays > 0 ? ((totalWinDays / recordedTotalDays) * 100).toFixed(1) + "%" : "0.0%";

  // Sheet 1: Account Overview
  const overviewRows = [
    { "Account Parameter": "Account Owner (Gmail)", "Details": userEmail || "Anonymous Trader" },
    { "Account Parameter": "Trade Journal Period", "Details": yearRange },
    { "Account Parameter": "Export Date & Time", "Details": new Date().toLocaleString() },
    { "Account Parameter": "Annual Net PnL ($)", "Details": `$${totalPnL.toFixed(2)}` },
    { "Account Parameter": "Annual Net ROI (%)", "Details": `${totalRoi >= 0 ? "+" : ""}${totalRoi.toFixed(2)}%` },
    { "Account Parameter": "Total Winning Days", "Details": totalWinDays },
    { "Account Parameter": "Total Losing Days", "Details": totalLossDays },
    { "Account Parameter": "Overall Win Rate", "Details": overallWinRate },
  ];

  const workbook = XLSX.utils.book_new();

  // Create worksheets
  const wsOverview = XLSX.utils.json_to_sheet(overviewRows);
  const wsMonthly = XLSX.utils.json_to_sheet(monthlyRows);
  const wsDaily =
    dailyRows.length > 0
      ? XLSX.utils.json_to_sheet(dailyRows)
      : XLSX.utils.json_to_sheet([{ "Notice": "No daily trades logged yet." }]);

  // Add worksheets to workbook
  XLSX.utils.book_append_sheet(workbook, wsOverview, "Account Overview");
  XLSX.utils.book_append_sheet(workbook, wsMonthly, "Monthly Summary");
  XLSX.utils.book_append_sheet(workbook, wsDaily, "Daily Trade Log");

  // Format clean filename
  const cleanGmail = (userEmail || "Trader").split("@")[0].replace(/[^a-zA-Z0-9]/g, "_");
  const cleanPeriod = yearRange.replace(/\s/g, "");
  const filename = `SNGxCRYPTO_Trade_Journal_${cleanGmail}_${cleanPeriod}.xlsx`;

  // Trigger Excel file download
  XLSX.writeFile(workbook, filename);
}
