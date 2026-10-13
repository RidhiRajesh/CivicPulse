/**
 * Spatial-Semantic Civic Incident Correlation Service
 * CivicPulse Problem-Centric Differentiator
 */

// Configurable Constants for Correlation Engine
const MAX_RADIUS_METERS = 100;       // Geographic radius threshold in meters
const CORRELATION_THRESHOLD = 0.52;  // Combined score threshold to trigger correlation match

const WEIGHT_SPATIAL = 0.45;         // Weight for geographic proximity
const WEIGHT_CATEGORY = 0.25;        // Weight for category match
const WEIGHT_TEXT = 0.30;            // Weight for description similarity

// English stop words for text preprocessing
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'this', 'there', 'near', 'very', 'some', 'please', 'road', 'street'
]);

/**
 * Calculate distance in meters between two lat/lng coordinates using the Haversine formula
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Tokenize text into normalized lowercase words excluding punctuation and stop words
 */
function tokenizeText(text) {
  if (!text || typeof text !== 'string') return new Set();
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  return new Set(tokens);
}

/**
 * Calculate Jaccard text similarity score (0.0 to 1.0)
 */
function calculateTextSimilarity(textA, textB) {
  const setA = tokenizeText(textA);
  const setB = tokenizeText(textB);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const word of setA) {
    if (setB.has(word)) {
      intersectionCount++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionCount;
  return unionSize === 0 ? 0 : intersectionCount / unionSize;
}

/**
 * Compute spatial-semantic correlation between a new report and an existing incident
 */
function computeCorrelationScore(report, incident) {
  // 1. Category Hard Match
  const isCategoryMatch = report.category.toUpperCase() === incident.category.toUpperCase();
  if (!isCategoryMatch) {
    return {
      isMatch: false,
      distanceMeters: Infinity,
      categoryMatch: 0,
      textScore: 0,
      spatialScore: 0,
      correlationScore: 0,
      reason: 'Category mismatch',
    };
  }

  // 2. Spatial Proximity Calculation
  const distanceMeters = calculateHaversineDistance(
    parseFloat(report.latitude),
    parseFloat(report.longitude),
    parseFloat(incident.latitude),
    parseFloat(incident.longitude)
  );

  if (distanceMeters > MAX_RADIUS_METERS) {
    return {
      isMatch: false,
      distanceMeters,
      categoryMatch: 1,
      textScore: 0,
      spatialScore: 0,
      correlationScore: 0,
      reason: `Distance (${distanceMeters}m) exceeds max radius (${MAX_RADIUS_METERS}m)`,
    };
  }

  // Spatial Score: 1.0 at 0m, 0.5 at 50m, 0.0 at 100m
  const spatialScore = Math.max(0, 1 - distanceMeters / MAX_RADIUS_METERS);

  // 3. Text Similarity Calculation
  const textScore = calculateTextSimilarity(report.description, incident.description);

  // 4. Combined Correlation Score
  const categoryScore = isCategoryMatch ? 1 : 0;
  const correlationScore =
    spatialScore * WEIGHT_SPATIAL +
    categoryScore * WEIGHT_CATEGORY +
    textScore * WEIGHT_TEXT;

  const isMatch = correlationScore >= CORRELATION_THRESHOLD;

  return {
    isMatch,
    distanceMeters,
    categoryMatch: categoryScore,
    spatialScore: parseFloat(spatialScore.toFixed(3)),
    textScore: parseFloat(textScore.toFixed(3)),
    correlationScore: parseFloat(correlationScore.toFixed(3)),
    reason: isMatch ? 'Matched spatial-semantic correlation threshold' : 'Score below correlation threshold',
  };
}

/**
 * Evaluate a new report against candidate incidents to find the best correlation match
 */
function findBestIncidentMatch(newReport, candidateIncidents) {
  if (!candidateIncidents || candidateIncidents.length === 0) {
    return null;
  }

  let bestMatch = null;
  let highestScore = 0;

  for (const incident of candidateIncidents) {
    const evaluation = computeCorrelationScore(newReport, incident);
    if (evaluation.isMatch && evaluation.correlationScore > highestScore) {
      highestScore = evaluation.correlationScore;
      bestMatch = {
        incident,
        evaluation,
      };
    }
  }

  return bestMatch;
}

module.exports = {
  calculateHaversineDistance,
  calculateTextSimilarity,
  computeCorrelationScore,
  findBestIncidentMatch,
  MAX_RADIUS_METERS,
  CORRELATION_THRESHOLD,
};
