// HTTP status utilities

/**
 * Get Tailwind color class for status code dot
 */
export function getStatusDotColor(status: number): string {
  if (status >= 200 && status < 300) return "bg-green-500";
  if (status >= 300 && status < 400) return "bg-blue-400";
  if (status >= 400 && status < 500) return "bg-yellow-500";
  if (status >= 500) return "bg-red-500";
  return "bg-gray-400";
}

/**
 * Get the "worst" status color for a group of statuses (prioritize errors)
 */
export function getGroupStatusColor(statuses: number[]): string {
  let hasError = false;
  let hasWarning = false;
  let hasRedirect = false;
  
  for (const status of statuses) {
    if (status >= 500) hasError = true;
    else if (status >= 400) hasWarning = true;
    else if (status >= 300) hasRedirect = true;
  }
  
  if (hasError) return "bg-red-500";
  if (hasWarning) return "bg-yellow-500";
  if (hasRedirect) return "bg-blue-400";
  return "bg-green-500";
}
