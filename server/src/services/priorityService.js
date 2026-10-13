/**
 * Dynamic Community-Impact Priority Engine
 * CivicPulse Core Differentiator
 */

// 1. Configurable Severity Score Constants
const SEVERITY_SCORES = {
  LOW: 20,
  MEDIUM: 40,
  HIGH: 70,
  CRITICAL: 100,
};

// 2. Component Weights (Sum = 1.0)
const WEIGHT_SEVERITY = 0.40;       // 40% Severity weight
const WEIGHT_COMMUNITY = 0.30;      // 30% Community impact weight
const WEIGHT_AGE = 0.15;            // 15% Incident age weight
const WEIGHT_LOCATION_RISK = 0.15;  // 15% Location risk weight

// Maximum raw score reference for 0-100 scale normalization
const MAX_RAW_SCORE = (100 * WEIGHT_SEVERITY) + (40 * WEIGHT_COMMUNITY) + (30 * WEIGHT_AGE) + (15 * WEIGHT_LOCATION_RISK); // 58.75

/**
 * Calculate bounded logarithmic Community Score (max 40 points)
 * Uses log2 so 100 reports do not completely overwhelm severity.
 */
function calculateCommunityScore(uniqueSupportersCount = 1) {
  const count = Math.max(1, uniqueSupportersCount);
  const rawLogScore = 15 * Math.log2(1 + count);
  return Math.min(40, parseFloat(rawLogScore.toFixed(2)));
}

/**
 * Calculate Age Score (0.5 points per hour, max 30 points at 60 hours)
 */
function calculateAgeScore(createdAt = new Date()) {
  const now = Date.now();
  const createdTime = new Date(createdAt).getTime();
  const hoursOld = Math.max(0, (now - createdTime) / (1000 * 60 * 60));
  const rawAgeScore = hoursOld * 0.5;
  return Math.min(30, parseFloat(rawAgeScore.toFixed(2)));
}

/**
 * Calculate Location Risk Score (15 for high traffic / major infrastructure, 10 baseline)
 */
function calculateLocationRiskScore(category = 'OTHER', address = '') {
  const normCategory = (category || '').toUpperCase();
  const normAddress = (address || '').toLowerCase();

  const highRiskCategories = ['POTHOLE', 'DAMAGED_ROAD', 'WATER_LEAKAGE', 'DRAINAGE'];
  const highRiskKeywords = ['main', 'highway', 'junction', 'expressway', 'avenue', 'bus', 'station'];

  const isHighRiskCategory = highRiskCategories.includes(normCategory);
  const isHighRiskLocation = highRiskKeywords.some((keyword) => normAddress.includes(keyword));

  if (isHighRiskCategory || isHighRiskLocation) {
    return 15;
  }
  return 10;
}

/**
 * Calculate Community Impact Factor multiplier
 */
function calculateCommunityImpact(uniqueSupportersCount = 1) {
  const count = Math.max(1, uniqueSupportersCount);
  const impact = 1.0 + (count - 1) * 0.5;
  return parseFloat(impact.toFixed(2));
}

/**
 * Calculate normalized 0-100 Dynamic Priority Score
 */
function calculatePriorityScore({
  severity = 'MEDIUM',
  uniqueSupportersCount = 1,
  createdAt = new Date(),
  category = 'OTHER',
  address = '',
}) {
  const normSeverity = (severity || 'MEDIUM').toUpperCase();
  const severityVal = SEVERITY_SCORES[normSeverity] || 40;

  const communityVal = calculateCommunityScore(uniqueSupportersCount);
  const ageVal = calculateAgeScore(createdAt);
  const locationRiskVal = calculateLocationRiskScore(category, address);

  const rawScore =
    severityVal * WEIGHT_SEVERITY +
    communityVal * WEIGHT_COMMUNITY +
    ageVal * WEIGHT_AGE +
    locationRiskVal * WEIGHT_LOCATION_RISK;

  const normalized = (rawScore / MAX_RAW_SCORE) * 100;
  const finalPriority = Math.min(100, Math.max(0, normalized));

  return parseFloat(finalPriority.toFixed(2));
}

/**
 * Calculate detailed priority component breakdown
 */
function getPriorityBreakdown({
  severity = 'MEDIUM',
  uniqueSupportersCount = 1,
  createdAt = new Date(),
  category = 'OTHER',
  address = '',
}) {
  const normSeverity = (severity || 'MEDIUM').toUpperCase();
  const severityVal = SEVERITY_SCORES[normSeverity] || 40;
  const communityVal = calculateCommunityScore(uniqueSupportersCount);
  const ageVal = calculateAgeScore(createdAt);
  const locationRiskVal = calculateLocationRiskScore(category, address);

  const priorityScore = calculatePriorityScore({
    severity,
    uniqueSupportersCount,
    createdAt,
    category,
    address,
  });

  const now = Date.now();
  const hoursOld = Math.max(0, (now - new Date(createdAt).getTime()) / (1000 * 60 * 60));

  return {
    priorityScore,
    severity,
    severityScore: severityVal,
    uniqueSupportersCount,
    communityScore: communityVal,
    communityImpact: calculateCommunityImpact(uniqueSupportersCount),
    hoursOld: parseFloat(hoursOld.toFixed(1)),
    ageScore: ageVal,
    locationRiskScore: locationRiskVal,
  };
}

module.exports = {
  calculatePriorityScore,
  calculateCommunityImpact,
  calculateCommunityScore,
  calculateAgeScore,
  calculateLocationRiskScore,
  getPriorityBreakdown,
  SEVERITY_SCORES,
};
