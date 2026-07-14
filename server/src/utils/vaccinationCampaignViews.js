export function campaignStatusForHistory(campaign, assignment) {
  if (assignment?.completionStatus === "completed") return "completed";
  if (campaign.status === "overdue" || assignment?.completionStatus === "missed") return "overdue";
  if (campaign.status === "cancelled") return "cancelled";
  return "upcoming";
}

export function campaignHistoryRecord(campaign, assignment) {
  return {
    _id: `${campaign._id}-${assignment._id}`,
    campaignId: campaign._id,
    assignmentId: assignment._id,
    campaign: true,
    scheduleName: campaign.scheduleName,
    species: campaign.species,
    vaccineName: campaign.vaccineName,
    diseasePrevented: campaign.diseasePrevented,
    dateGiven: assignment.completedDate || campaign.firstVaccinationDate,
    nextDueDate: campaign.boosterDate || campaign.nextVaccinationDate || campaign.scheduledDate,
    vetName: campaign.vetName || campaign.provider,
    batchNumber: campaign.batchNumber,
    totalCost: campaign.assignments?.length ? Number(campaign.totalCost || 0) / campaign.assignments.length : Number(campaign.totalCost || 0),
    campaignTotalCost: Number(campaign.totalCost || 0),
    status: campaignStatusForHistory(campaign, assignment),
    completionStatus: assignment.completionStatus,
    notes: assignment.notes || campaign.notes
  };
}
