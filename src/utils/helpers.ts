export function calculateDaysLeft(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function getFreshnessLabel(daysLeft: number): 'fresh' | 'expiring' | 'expired' {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 3) return 'expiring';
  return 'fresh';
}

export function calculateWasteScore(db: any): number {
  const stats = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as usedCount,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expiredCount
    FROM items
  `).get();

  const finishedCount = (stats.usedCount || 0) + (stats.expiredCount || 0);
  if (finishedCount === 0) return 100;

  return Math.round(((stats.usedCount || 0) / finishedCount) * 100);
}
