export function calendarDate(date: Date) {
  return `${date.getFullYear().toString().padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function relativeCalendarDate(offset: number, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + offset);
  return calendarDate(date);
}
export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && calendarDate(date) === value;
}

export function validBirthdate(value: string, today = new Date()) {
  return validCalendarDate(value) && value <= calendarDate(today);
}

export function latestAllowedBirthdateDate(today = new Date(), minAge = 13) {
  const date = new Date(today);
  const year = date.getFullYear() - minAge;
  const month = date.getMonth();
  const day = date.getDate();
  date.setFullYear(year, month, 1);
  date.setDate(Math.min(day, new Date(year, month + 1, 0).getDate()));
  return date;
}
export function latestAllowedBirthdate(today = new Date(), minAge = 13) {
  return calendarDate(latestAllowedBirthdateDate(today, minAge));
}
export function frenchCalendarDate(value: string) {
  if (!validCalendarDate(value)) return value;
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}
