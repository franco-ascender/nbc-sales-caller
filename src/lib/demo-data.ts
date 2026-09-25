import type { CallRecord, Outcome } from "@/components/dashboard/Dashboard.types";

const people = [
  ["Olivia Bennett", "OB", "Northstar Studio"],
  ["James Mitchell", "JM", "Summit & Co."],
  ["Sophia Chen", "SC", "Evergreen Group"],
  ["Liam Anderson", "LA", "Fieldwork"],
  ["Emma Wilson", "EW", "Oak & Avenue"],
  ["Noah Williams", "NW", "Westward"],
  ["Isabella Davis", "ID", "Meridian"],
  ["Ethan Parker", "EP", "Good Company"],
  ["Ava Thompson", "AT", "Common Ground"],
  ["Lucas Morgan", "LM", "Bluebird"],
  ["Mia Robinson", "MR", "Brightside"],
  ["Benjamin Lee", "BL", "Daybreak"],
] as const;
const outcomes: Outcome[] = ["Booked", "Qualified", "Booked", "Follow-up", "No answer", "Booked", "Transferred", "Qualified"];
const summaries: Record<Outcome, string> = {
  Booked: "Discussed the current process and the team's goals. Confirmed interest in a discovery conversation and agreed on a time.",
  Qualified: "Confirmed a relevant need and decision-making responsibility. The contact would like to review available times before booking.",
  "Follow-up": "Interested in learning more, but the timing was not right. Requested a follow-up conversation later this week.",
  "No answer": "The contact did not answer. No conversation took place and no appointment was created.",
  Transferred: "The contact asked a question that needs a team member. The conversation was marked for a human handoff.",
};

export const DEMO_ANCHOR = new Date("2026-09-12T18:00:00Z");

export const demoCalls: CallRecord[] = Array.from({ length: 64 }, (_, index): CallRecord => {
  const person = people[index % people.length];
  const outcome = outcomes[index % outcomes.length];
  const date = new Date(DEMO_ANCHOR.getTime() - Math.floor(index / 3) * 86_400_000 - (index % 3) * 3_720_000);
  return {
    id: `demo-call-${String(index + 1).padStart(3, "0")}`,
    contactId: `demo-contact-${index % people.length}`,
    name: person[0], initials: person[1], company: person[2],
    phone: `+1 (202) 555-01${String(index % people.length).padStart(2, "0")}`,
    email: `${person[0].toLowerCase().replaceAll(" ", ".")}@example.com`,
    date: date.toISOString(),
    duration: outcome === "No answer" ? 0 : 85 + (index * 47) % 270,
    responseMs: outcome === "No answer" ? null : 590 + (index * 31) % 370,
    outcome,
    source: (["Website form", "Facebook lead ad", "Referral"] as const)[index % 3],
    appointment: outcome === "Booked" ? new Date(date.getTime() + 2 * 86_400_000).toISOString() : null,
    summary: summaries[outcome],
  };
});
