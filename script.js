// ====================================
// Global Variables for Charts and Funds
// ====================================
let sipChart, lumpsumChart, loanChart;
let allFunds = []; // Global store for mutual fund data

// ====================================
// Helper Functions
// ====================================
function parseDate(str) {
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    str = convertAPIDate(str);
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) console.error("Invalid date string:", str);
  return d;
}
function formatDate(date) {
  if (!date || isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}
function convertAPIDate(apiDateStr) {
  if (!apiDateStr || typeof apiDateStr !== "string") return "";
  const parts = apiDateStr.split("-");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
function normalizeData(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null && data.data && Array.isArray(data.data)) {
    return data.data;
  }
  throw new Error("Invalid data structure received from API");
}
function getNAVForDate(navData, dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) dateStr = convertAPIDate(dateStr);
  let exact = navData.find(entry => entry.date === dateStr);
  if (exact && !isNaN(parseFloat(exact.nav))) return parseFloat(exact.nav);
  let filtered = navData.filter(entry => entry.date < dateStr && entry.date !== "");
  if (filtered.length > 0) return parseFloat(filtered[filtered.length - 1].nav);
  return parseFloat(navData[0].nav);
}
function formatIndianCurrency(num) {
  let x = Number(num).toFixed(2);
  let parts = x.split(".");
  let lastThree = parts[0].slice(-3);
  let otherNumbers = parts[0].slice(0, -3);
  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  let formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return "₹" + formatted + "." + parts[1];
}

// ====================================
// Chart Update Functions
// ====================================
function updateSIPChart(labels, investedData, portfolioData) {
  const ctx = document.getElementById("sipChart").getContext("2d");
  if (sipChart) sipChart.destroy();
  sipChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "Total Invested (₹)", data: investedData, borderColor: "#0077CC", backgroundColor: "rgba(0,119,204,0.2)", fill: false, tension: 0.1 },
        { label: "Portfolio Value (₹)", data: portfolioData, borderColor: "#FF6600", backgroundColor: "rgba(255,102,0,0.2)", fill: false, tension: 0.1 }
      ]
    },
    options: {
      scales: { 
        x: { ticks: { autoSkip: true, maxTicksLimit: 12, color: "#222" }, grid: { color: "#ccc" } },
        y: { ticks: { color: "#222" }, grid: { color: "#ccc" } }
      },
      plugins: { legend: { labels: { color: "#222" } } }
    }
  });
  document.getElementById("sipChart").style.display = "block";
}
function updateLumpsumChart(labels, portfolioData) {
  const ctx = document.getElementById("lumpsumChart").getContext("2d");
  if (lumpsumChart) lumpsumChart.destroy();
  lumpsumChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "Portfolio Value (₹)", data: portfolioData, borderColor: "#FF6600", backgroundColor: "rgba(255,102,0,0.2)", fill: false, tension: 0.1 }
      ]
    },
    options: {
      scales: { 
        x: { ticks: { autoSkip: true, maxTicksLimit: 12, color: "#222" }, grid: { color: "#ccc" } },
        y: { ticks: { color: "#222" }, grid: { color: "#ccc" } }
      },
      plugins: { legend: { labels: { color: "#222" } } }
    }
  });
  document.getElementById("lumpsumChart").style.display = "block";
}
function updateLoanChart(labels, dataPoints) {
  const ctx = document.getElementById("loanChart").getContext("2d");
  if (loanChart) loanChart.destroy();
  loanChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "EMI Variation", data: dataPoints, borderColor: "#0077CC", backgroundColor: "rgba(0,119,204,0.2)", fill: false, tension: 0.1 }
      ]
    },
    options: {
      scales: { 
        x: { ticks: { color: "#222" }, grid: { color: "#ccc" } },
        y: { ticks: { color: "#222" }, grid: { color: "#ccc" } }
      },
      plugins: { legend: { labels: { color: "#222" } } }
    }
  });
  document.getElementById("loanChart").style.display = "block";
}
function updateSWPPieChart(totalWithdrawals, finalPortfolio) {
  const ctx = document.getElementById("swpPieChart").getContext("2d");
  if (window.swpPieChart && typeof window.swpPieChart.destroy === "function") {
    window.swpPieChart.destroy();
  }
  window.swpPieChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Total Withdrawals", "Current Investment"],
      datasets: [{
        data: [totalWithdrawals, finalPortfolio],
        backgroundColor: ["#FF6600", "#0077CC"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { position: "bottom", labels: { color: "#222", font: { size: 14 } } },
        tooltip: { enabled: true }
      }
    }
  });
  document.getElementById("swpPieChart").style.display = "block";
}

// ====================================
// Mutual Fund House Names Feature
// ====================================
// Fallback extractor for fund house from scheme name
function extractFundHouse(schemeName) {
  const commonFundHouses = [
    "HDFC", "ICICI", "SBI", "Axis", "Kotak", "Aditya Birla",
    "Nippon", "UTI", "DSP", "IDFC", "Tata", "L&T", "Motilal Oswal", "Franklin Templeton"
  ];
  for (let house of commonFundHouses) {
    if (schemeName.toLowerCase().includes(house.toLowerCase())) {
      return house;
    }
  }
  return "Other";
}

// Extract unique mutual fund house names from API data using meta.fund_house
function getUniqueFundHouses(data) {
  const houses = data.map(fund => {
    const schemeName = fund.schemeName || (fund.meta && fund.meta.scheme_name) || "";
    // Use meta.fund_house if available; otherwise, extract from schemeName
    return (fund.meta && fund.meta.fund_house) ? fund.meta.fund_house : extractFundHouse(schemeName);
  }).filter(house => house && house.trim() !== "");
  return Array.from(new Set(houses)).sort();
}

// ====================================
// Mutual Fund List, House Filtering & Selection
// ====================================
function populateFundList() {
  fetch("https://api.mfapi.in/mf")
    .then(response => response.json())
    .then(data => {
      // Build allFunds array using meta data or fallback extraction
      allFunds = data
        .map(fund => {
          let schemeName = fund.schemeName || (fund.meta && fund.meta.scheme_name);
          let schemeCode = fund.schemeCode || (fund.meta && fund.meta.scheme_code);
          let fundHouse = (fund.meta && fund.meta.fund_house) || extractFundHouse(schemeName);
          return { schemeName, schemeCode, fundHouse };
        })
        .filter(fund => fund.schemeName && fund.schemeCode);
      
      // Get unique fund houses from the raw data
      const uniqueHouses = getUniqueFundHouses(data);
      populateFundHouseSelect(uniqueHouses);
      
      filterFundList("");
    })
    .catch(err => console.error("Error populating fund list:", err));
}
document.addEventListener("DOMContentLoaded", populateFundList);

// Populate the dropdown using the provided list of fund houses
function populateFundHouseSelect(houses) {
  const select = document.getElementById("fundHouseSelect");
  select.innerHTML = '<option value="All">All</option>';
  houses.forEach(house => {
    const option = document.createElement("option");
    option.value = house;
    option.textContent = house;
    select.appendChild(option);
  });
}

function filterFundList(query) {
  const fundList = document.getElementById("fundList");
  fundList.innerHTML = "";
  const selectedHouse = document.getElementById("fundHouseSelect").value;
  const filtered = allFunds.filter(fund => {
    const matchesQuery = fund.schemeName.toLowerCase().includes(query.toLowerCase());
    const matchesHouse = selectedHouse === "All" || fund.fundHouse === selectedHouse;
    return matchesQuery && matchesHouse;
  });
  const limited = filtered.slice(0, 10);
  limited.forEach(fund => {
    const option = document.createElement("option");
    option.value = fund.schemeName;
    option.setAttribute("data-id", fund.schemeCode);
    fundList.appendChild(option);
  });
}

document.getElementById("fundNameInput").addEventListener("input", function() {
  filterFundList(this.value);
});
document.getElementById("fundHouseSelect").addEventListener("change", function() {
  filterFundList(document.getElementById("fundNameInput").value);
});

function getSelectedFundId() {
  const input = document.getElementById("fundNameInput");
  const datalist = document.getElementById("fundList");
  const options = datalist.options;
  console.log("User input fund name:", input.value);
  for (let i = 0; i < options.length; i++) {
    if (options[i].value.trim().toLowerCase() === input.value.trim().toLowerCase()) {
      const fundId = options[i].getAttribute("data-id");
      console.log("Matched fund ID:", fundId);
      return fundId;
    }
  }
  console.warn("No matching fund ID found for input:", input.value);
  return null;
}

// ====================================
// Historical NAV Data Fetching
// ====================================
function fetchHistoricalData(fundId) {
  const cacheKey = `historicalData_${fundId}`;
  const today = new Date().toISOString().split("T")[0];
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const cachedObj = JSON.parse(cached);
    if (cachedObj.lastUpdated === today) return Promise.resolve(cachedObj.data);
  }
  const apiUrl = `https://api.mfapi.in/mf/${fundId}`;
  console.log("Fetching historical data from:", apiUrl);
  return fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      let normalized = normalizeData(data);
      normalized = normalized.map(entry => ({ ...entry, date: convertAPIDate(entry.date) }));
      normalized = normalized.filter(entry => !isNaN(parseDate(entry.date).getTime()));
      normalized.sort((a, b) => parseDate(a.date) - parseDate(b.date));
      localStorage.setItem(cacheKey, JSON.stringify({ lastUpdated: today, data: normalized }));
      return normalized;
    });
}

// ====================================
// Latest NAV Data Fetching
// ====================================
function fetchLatestNAV(fundId) {
  const apiUrl = `https://api.mfapi.in/mf/${fundId}`;
  console.log("Fetching latest NAV from:", apiUrl);
  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      let normalized = normalizeData(data);
      normalized = normalized.map(entry => ({ ...entry, date: convertAPIDate(entry.date) }));
      const latestData = normalized[0];
      if (!latestData) throw new Error("No NAV data available");
      document.getElementById("latestNAV").innerHTML =
        `<p>Latest NAV (as on ${latestData.date}): ${formatIndianCurrency(latestData.nav)}</p>`;
    })
    .catch(err => {
      console.error("Error fetching latest NAV:", err);
      document.getElementById("latestNAV").innerHTML = `<p>Error fetching latest NAV. Please try again later.</p>`;
    });
}
document.getElementById("fundNameInput").addEventListener("change", function () {
  const fundId = getSelectedFundId();
  if (fundId) fetchLatestNAV(fundId);
});

// ====================================
// SIP Calculator
// ====================================
function calculateSIP(navData, startDateStr, endDateStr, sipAmount, sipType, stepUpPercent = 0) {
  let totalInvested = 0, totalUnits = 0;
  let startD = parseDate(startDateStr), endD = parseDate(endDateStr);
  let currentD = new Date(startD);
  const dates = [], investedArr = [], portfolioArr = [];
  while (currentD <= endD) {
    let currentSipAmount = sipAmount;
    if (sipType === 'stepup') {
      const yearsPassed = currentD.getFullYear() - startD.getFullYear();
      currentSipAmount = sipAmount * Math.pow(1 + (stepUpPercent / 100), yearsPassed);
    }
    const dateStr = formatDate(currentD);
    const navValue = getNAVForDate(navData, dateStr);
    if (!isNaN(navValue)) {
      const units = currentSipAmount / navValue;
      totalUnits += units;
      totalInvested += currentSipAmount;
      dates.push(dateStr);
      investedArr.push(totalInvested.toFixed(2));
      portfolioArr.push((totalUnits * navValue).toFixed(2));
    }
    currentD.setMonth(currentD.getMonth() + 1);
  }
  const endNAV = getNAVForDate(navData, formatDate(endD));
  const finalValue = totalUnits * endNAV;
  const totalYears = (endD - startD) / (365.25 * 24 * 3600 * 1000);
  const CAGR = Math.pow(finalValue / totalInvested, 1 / totalYears) - 1;
  const returnPct = ((finalValue - totalInvested) / totalInvested) * 100;
  updateSIPChart(dates, investedArr, portfolioArr);
  return { 
    totalInvested: totalInvested.toFixed(2), 
    finalValue: finalValue.toFixed(2), 
    CAGR: (CAGR * 100).toFixed(2), 
    returnPct: returnPct.toFixed(2),
    dates, investedArr, portfolioArr
  };
}
document.getElementById("calcSIP").addEventListener("click", function () {
  const fundId = getSelectedFundId();
  if (!fundId) { alert("Please select a valid mutual fund from the list."); return; }
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const sipAmount = parseFloat(document.getElementById("sipAmount").value);
  const sipType = document.getElementById("sipType").value;
  const stepUpPercent = sipType === "stepup" ? parseFloat(document.getElementById("stepUpPercent").value) || 0 : 0;
  fetchHistoricalData(fundId)
    .then(navData => {
      const result = calculateSIP(navData, startDate, endDate, sipAmount, sipType, stepUpPercent);
      document.getElementById("sipResult").innerHTML =
        `<h3>SIP Calculation Results:</h3>
         <p>Total Invested: ${formatIndianCurrency(result.totalInvested)}</p>
         <p>Final Value: ${formatIndianCurrency(result.finalValue)}</p>
         <p>CAGR: ${result.CAGR}%</p>
         <p>Return (%): ${result.returnPct}%</p>`;
    })
    .catch(err => {
      console.error("Error fetching historical NAV data:", err);
      document.getElementById("sipResult").innerHTML = `<p>Error fetching data. Please try again.</p>`;
    });
});
document.getElementById("sipType").addEventListener("change", function() {
  document.getElementById("stepUpContainer").style.display = this.value === "stepup" ? "block" : "none";
});

// ====================================
// SWP Calculator
// ====================================
function calculateSWP(navData, startDateStr, endDateStr, initialPortfolio, withdrawal) {
  let portfolio = initialPortfolio;
  const startDate = parseDate(startDateStr);
  const endDate = parseDate(endDateStr);
  let previousNAV = getNAVForDate(navData, formatDate(startDate));
  let currentDate = new Date(startDate);
  let monthCount = 0;
  while (currentDate < endDate) {
    currentDate.setMonth(currentDate.getMonth() + 1);
    monthCount++;
    const currentNAV = getNAVForDate(navData, formatDate(currentDate));
    portfolio = portfolio * (currentNAV / previousNAV) - withdrawal;
    previousNAV = currentNAV;
  }
  const totalReturn = portfolio - initialPortfolio;
  const returnPct = (totalReturn / initialPortfolio) * 100;
  const years = (endDate - startDate) / (365.25 * 24 * 3600 * 1000);
  const CAGR = Math.pow(portfolio / initialPortfolio, 1 / years) - 1;
  return {
    finalPortfolio: portfolio.toFixed(2),
    totalWithdrawals: (withdrawal * monthCount).toFixed(2),
    totalReturn: totalReturn.toFixed(2),
    CAGR: (CAGR * 100).toFixed(2),
    returnPct: returnPct.toFixed(2)
  };
}
document.getElementById("calcSWP").addEventListener("click", function () {
  const fundId = getSelectedFundId();
  if (!fundId) {
    alert("Please select a valid mutual fund for SWP calculations.");
    return;
  }
  const swpStartDate = document.getElementById("swpStartDate").value;
  const swpEndDate = document.getElementById("swpEndDate").value;
  const initialPortfolio = parseFloat(document.getElementById("initialPortfolio").value);
  const withdrawal = parseFloat(document.getElementById("withdrawalAmount").value);
  fetchHistoricalData(fundId)
    .then(navData => {
      const result = calculateSWP(navData, swpStartDate, swpEndDate, initialPortfolio, withdrawal);
      document.getElementById("swpResult").innerHTML =
        `<h3>SWP Calculation Results:</h3>
         <p>Current Investment Value: ${formatIndianCurrency(result.finalPortfolio)}</p>
         <p>Total Withdrawn: ${formatIndianCurrency(result.totalWithdrawals)}</p>
         <p>Total Return: ${formatIndianCurrency(result.totalReturn)}</p>
         <p>CAGR: ${result.CAGR}%</p>
         <p>Return (%): ${result.returnPct}%</p>`;
      updateSWPPieChart(result.totalWithdrawals, result.finalPortfolio);
    })
    .catch(err => {
      console.error("Error fetching historical NAV data for SWP:", err);
      document.getElementById("swpResult").innerHTML = `<p>Error fetching data. Please try again.</p>`;
    });
});

// ====================================
// Lumpsum Calculator
// ====================================
function calculateLumpsum(navData, startDateStr, endDateStr, lumpsumAmount) {
  const startDate = parseDate(startDateStr);
  const endDate = parseDate(endDateStr);
  const startNAV = getNAVForDate(navData, formatDate(startDate));
  const endNAV = getNAVForDate(navData, formatDate(endDate));
  const finalValue = lumpsumAmount * (endNAV / startNAV);
  const totalYears = (endDate - startDate) / (365.25 * 24 * 3600 * 1000);
  const CAGR = Math.pow(finalValue / lumpsumAmount, 1 / totalYears) - 1;
  const returnPct = ((finalValue - lumpsumAmount) / lumpsumAmount) * 100;
  return {
    finalValue: finalValue.toFixed(2),
    CAGR: (CAGR * 100).toFixed(2),
    returnPct: returnPct.toFixed(2)
  };
}
function updateLumpsumChartWrapper(navData, startDateStr, endDateStr, lumpsumAmount) {
  let startDate = parseDate(startDateStr);
  let endDate = parseDate(endDateStr);
  const dates = [];
  const portfolioArr = [];
  let currentDate = new Date(startDate);
  const startNAV = getNAVForDate(navData, formatDate(startDate));
  let units = lumpsumAmount / startNAV;
  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    dates.push(dateStr);
    portfolioArr.push((units * getNAVForDate(navData, dateStr)).toFixed(2));
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  updateLumpsumChart(dates, portfolioArr);
}
document.getElementById("calcLumpsum").addEventListener("click", function () {
  const fundId = getSelectedFundId();
  if (!fundId) {
    alert("Please select a valid mutual fund for Lumpsum calculations.");
    return;
  }
  const startDate = document.getElementById("lumpsumStartDate").value;
  const endDate = document.getElementById("lumpsumEndDate").value;
  const lumpsumAmount = parseFloat(document.getElementById("lumpsumAmount").value);
  fetchHistoricalData(fundId)
    .then(navData => {
      const result = calculateLumpsum(navData, startDate, endDate, lumpsumAmount);
      document.getElementById("lumpsumResult").innerHTML =
        `<h3>Lumpsum Calculation Results:</h3>
         <p>Final Value: ${formatIndianCurrency(result.finalValue)}</p>
         <p>CAGR: ${result.CAGR}%</p>
         <p>Return (%): ${result.returnPct}%</p>`;
      updateLumpsumChartWrapper(navData, startDate, endDate, lumpsumAmount);
    })
    .catch(err => {
      console.error("Error fetching historical NAV data for Lumpsum:", err);
      document.getElementById("lumpsumResult").innerHTML = `<p>Error fetching data. Please try again.</p>`;
    });
});

// ====================================
// Goal Based Planner Calculator
// ====================================
document.getElementById("calcGoal").addEventListener("click", function () {
  const goalOption = document.querySelector(".goal-option-btn.active").getAttribute("data-option");
  const targetAmount = parseFloat(document.getElementById("targetAmount").value);
  const goalReturn = parseFloat(document.getElementById("goalReturn").value) / 100;
  const years = parseFloat(document.getElementById("goalYears").value);
  let resultHTML = "<h3>Goal Based Planner Results:</h3>";
  
  if (goalOption === "investment") {
    if (document.getElementById("investmentMode").value === "lumpsum") {
      const requiredLumpsum = targetAmount / Math.pow(1 + goalReturn, years);
      resultHTML += `<p>Required Lumpsum Investment: ${formatIndianCurrency(requiredLumpsum)}</p>`;
    } else {
      const n = years * 12;
      const r = goalReturn / 12;
      const factor = ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
      let requiredSIP = targetAmount / factor;
      const stepUp = parseFloat(document.getElementById("goalStepUpPercent").value) || 0;
      resultHTML += `<p>Required Monthly SIP (base value): ${formatIndianCurrency(requiredSIP)}</p>`;
      if (stepUp > 0) {
        resultHTML += `<p>Note: A step-up of ${stepUp}% per year is optional and may reduce the required base SIP.</p>`;
      }
    }
  } else if (goalOption === "time") {
    if (document.getElementById("investmentMode").value === "lumpsum") {
      const lumpsumGiven = parseFloat(document.getElementById("existingLumpsum").value);
      const yearsNeeded = Math.log(targetAmount / lumpsumGiven) / Math.log(1 + goalReturn);
      resultHTML += `<p>Time Required (Lumpsum): ${yearsNeeded.toFixed(2)} years</p>`;
    } else {
      const sipGiven = parseFloat(document.getElementById("existingSIP").value);
      let n = 1;
      const r = goalReturn / 12;
      while (sipGiven * ((Math.pow(1 + r, n) - 1) / r) * (1 + r) < targetAmount && n < 1000) {
        n++;
      }
      resultHTML += `<p>Time Required (SIP): ${(n / 12).toFixed(2)} years</p>`;
    }
  } else if (goalOption === "combination") {
    resultHTML += `<p>Combination mode calculations are not implemented.</p>`;
  }
  document.getElementById("goalResult").innerHTML = resultHTML;
});
document.addEventListener("DOMContentLoaded", function() {
  const goalButtons = document.querySelectorAll(".goal-option-btn");
  goalButtons.forEach(btn => {
    btn.addEventListener("click", function() {
      goalButtons.forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const option = this.getAttribute("data-option");
      if (option === "investment") {
        document.getElementById("investmentInputs").style.display = "block";
        document.getElementById("timeInputs").style.display = "none";
        document.getElementById("combinationInputs").style.display = "none";
      } else if (option === "time") {
        document.getElementById("investmentInputs").style.display = "none";
        document.getElementById("timeInputs").style.display = "block";
        document.getElementById("combinationInputs").style.display = "none";
      } else if (option === "combination") {
        document.getElementById("investmentInputs").style.display = "none";
        document.getElementById("timeInputs").style.display = "none";
        document.getElementById("combinationInputs").style.display = "block";
      }
    });
  });
  document.getElementById("investmentMode").addEventListener("change", function() {
    document.getElementById("goalSipInputs").style.display = this.value === "sip" ? "block" : "none";
  });
});

// ====================================
// Retirement Planner Calculator
// ====================================
function calculateRetirementCorpus(currentSavings, monthlyContribution, years, stepUp, annualReturn, inflationRate) {
  const n = years * 12;
  const r = annualReturn / 100 / 12;
  let corpusFromSavings = currentSavings * Math.pow(1 + r, n);
  let corpusFromContributions = 0;
  for (let m = 0; m < n; m++) {
    let yearsPassed = Math.floor(m / 12);
    let contribution = monthlyContribution * Math.pow(1 + (stepUp / 100), yearsPassed);
    corpusFromContributions += contribution * Math.pow(1 + r, n - m);
  }
  let totalCorpus = corpusFromSavings + corpusFromContributions;
  if (inflationRate) {
    totalCorpus = totalCorpus / Math.pow(1 + (inflationRate / 100) / 12, n);
  }
  return totalCorpus;
}
document.getElementById("calcRetirement").addEventListener("click", function() {
  const currentAge = parseFloat(document.getElementById("currentAge").value);
  const retirementAge = parseFloat(document.getElementById("retirementAge").value);
  const currentSavings = parseFloat(document.getElementById("currentSavingsRet").value);
  const monthlyContribution = parseFloat(document.getElementById("monthlyContributionRet").value);
  const stepUp = parseFloat(document.getElementById("retStepUp").value) || 0;
  const annualReturn = parseFloat(document.getElementById("retAnnualReturn").value);
  const inflationRate = parseFloat(document.getElementById("retInflationRate").value) || 0;
  const years = retirementAge - currentAge;
  const corpus = calculateRetirementCorpus(currentSavings, monthlyContribution, years, stepUp, annualReturn, inflationRate);
  document.getElementById("retirementResult").innerHTML =
    `<h3>Retirement Planner Results:</h3>
     <p>Estimated Corpus at Retirement: ${formatIndianCurrency(corpus.toFixed(2))}</p>`;
});

// ====================================
// Children Education Planner Calculator
// ====================================
function calculateEducationPlanner(childAge, eduAge, currentCost, inflationRate, monthlyContribution, stepUp, annualReturn, currentSavings) {
  const years = eduAge - childAge;
  const futureCost = currentCost * Math.pow(1 + inflationRate / 100, years);
  const n = years * 12;
  const r = annualReturn / 100 / 12;
  let futureSavings = currentSavings * Math.pow(1 + r, n);
  let futureContributions = 0;
  for (let m = 0; m < n; m++) {
    let yearsPassed = Math.floor(m / 12);
    let contribution = monthlyContribution * Math.pow(1 + (stepUp / 100), yearsPassed);
    futureContributions += contribution * Math.pow(1 + r, n - m);
  }
  const totalCorpus = futureSavings + futureContributions;
  return { futureCost, totalCorpus, gap: Math.max(0, futureCost - totalCorpus) };
}
document.getElementById("calcEducation").addEventListener("click", function() {
  const childAge = parseFloat(document.getElementById("childAge").value);
  const eduAge = parseFloat(document.getElementById("eduAge").value);
  const currentCost = parseFloat(document.getElementById("currentCostEdu").value);
  const inflationRate = parseFloat(document.getElementById("eduInflationRate").value) || 0;
  const monthlyContribution = parseFloat(document.getElementById("monthlyContributionEdu").value);
  const stepUp = parseFloat(document.getElementById("eduStepUp").value) || 0;
  const annualReturn = parseFloat(document.getElementById("eduAnnualReturn").value);
  const currentSavings = parseFloat(document.getElementById("currentSavingsEdu").value);
  const { futureCost, totalCorpus, gap } = calculateEducationPlanner(childAge, eduAge, currentCost, inflationRate, monthlyContribution, stepUp, annualReturn, currentSavings);
  document.getElementById("educationResult").innerHTML =
    `<h3>Children Education Planner Results:</h3>
     <p>Estimated Cost at Education Age: ${formatIndianCurrency(futureCost.toFixed(2))}</p>
     <p>Future Value of Savings & Contributions: ${formatIndianCurrency(totalCorpus.toFixed(2))}</p>
     <p>Additional Corpus Needed: ${formatIndianCurrency(gap.toFixed(2))}</p>`;
});

// ====================================
// Loan Calculator
// ====================================
function calculateLoanEMI(loanAmount, annualInterestRate, tenureYears) {
  const r = annualInterestRate / 100 / 12;
  const n = tenureYears * 12;
  const EMI = loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const totalPayment = EMI * n;
  const totalInterest = totalPayment - loanAmount;
  return { EMI, totalInterest, totalPayment };
}
function simulateLoanEMI(loanAmount, annualInterestRate, tenureYears) {
  const dataPoints = [];
  const labels = [];
  for (let rate = annualInterestRate - 2; rate <= annualInterestRate + 2; rate += 0.5) {
    const r = rate / 100 / 12;
    const n = tenureYears * 12;
    const EMI = loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    labels.push(rate.toFixed(1) + "%");
    dataPoints.push(EMI.toFixed(2));
  }
  updateLoanChart(labels, dataPoints);
}
document.querySelectorAll('.loan-mode-btn').forEach(button => {
  button.addEventListener("click", function() {
    document.querySelectorAll('.loan-mode-btn').forEach(btn => btn.classList.remove("active"));
    this.classList.add("active");
    const mode = this.getAttribute("data-mode");
    if (mode === "emi") {
      document.getElementById("loanAmountGroup").style.display = "block";
      document.getElementById("loanInterestGroup").style.display = "block";
      document.getElementById("loanTenureGroup").style.display = "block";
      document.getElementById("loanEMIGroup").style.display = "none";
    } else if (mode === "tenure") {
      document.getElementById("loanAmountGroup").style.display = "block";
      document.getElementById("loanInterestGroup").style.display = "block";
      document.getElementById("loanTenureGroup").style.display = "none";
      document.getElementById("loanEMIGroup").style.display = "block";
    } else if (mode === "rate") {
      document.getElementById("loanAmountGroup").style.display = "block";
      document.getElementById("loanInterestGroup").style.display = "none";
      document.getElementById("loanTenureGroup").style.display = "block";
      document.getElementById("loanEMIGroup").style.display = "block";
    }
  });
});
document.getElementById("calcLoan").addEventListener("click", function() {
  const activeLoanButton = document.querySelector('.loan-mode-btn.active');
  if (!activeLoanButton) {
    alert("Please select a loan mode.");
    return;
  }
  const loanMode = activeLoanButton.getAttribute("data-mode");
  if (loanMode === "emi") {
    const loanAmount = parseFloat(document.getElementById("loanAmount").value);
    const loanInterest = parseFloat(document.getElementById("loanInterest").value);
    const loanTenure = parseFloat(document.getElementById("loanTenure").value);
    const result = calculateLoanEMI(loanAmount, loanInterest, loanTenure);
    document.getElementById("loanResult").innerHTML =
      `<h3>Loan Calculator Results (EMI Mode):</h3>
       <p>Monthly EMI: ${formatIndianCurrency(result.EMI)}</p>
       <p>Total Interest Payable: ${formatIndianCurrency(result.totalInterest)}</p>
       <p>Total Payment: ${formatIndianCurrency(result.totalPayment)}</p>`;
    simulateLoanEMI(loanAmount, loanInterest, loanTenure);
  } else if (loanMode === "tenure") {
    document.getElementById("loanResult").innerHTML =
      `<h3>Loan Calculator Results (Tenure Mode):</h3><p>Feature under development.</p>`;
    document.getElementById("loanChart").style.display = "none";
  } else if (loanMode === "rate") {
    document.getElementById("loanResult").innerHTML =
      `<h3>Loan Calculator Results (Rate Mode):</h3><p>Feature under development.</p>`;
    document.getElementById("loanChart").style.display = "none";
  }
});

// ====================================
// Toggle Button Functionality (Burger Toggle)
// ====================================
document.querySelectorAll(".toggle-btn").forEach(btn => {
  btn.addEventListener("click", function() {
    const targetId = this.getAttribute("data-target");
    const content = document.getElementById(targetId);
    content.style.display = content.style.display === "block" ? "none" : "block";
  });
});
