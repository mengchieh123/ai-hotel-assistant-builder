function getDaysBetweenDates(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end - start;
  const diffDays = diffTime / (1000 * 3600 * 24);
  return diffDays > 0 ? Math.ceil(diffDays) : 1;
}

module.exports = { getDaysBetweenDates };
