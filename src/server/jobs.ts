import {
  listScheduledJobs as _listScheduledJobs,
  createScheduledJob as _createScheduledJob,
  updateScheduledJob as _updateScheduledJob,
  deleteScheduledJob as _deleteScheduledJob,
  runScheduledJobNow as _runScheduledJobNow,
  getSchedulerStatus as _getSchedulerStatus,
} from './jobs/scheduler'

export async function listScheduledJobs() {
  return _listScheduledJobs()
}
export async function createScheduledJob(_input: unknown) {
  return _createScheduledJob(_input)
}
export async function updateScheduledJob(_input: unknown) {
  return _updateScheduledJob(_input)
}
export async function deleteScheduledJob(_input: unknown) {
  return _deleteScheduledJob(_input)
}
export async function runScheduledJobNow(_input: unknown) {
  return _runScheduledJobNow(_input)
}
export async function getSchedulerStatus() {
  return _getSchedulerStatus()
}
