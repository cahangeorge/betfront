import { describe, expect, it } from 'vitest'

import {
  ALL_LEAGUES_VALUE,
  expandCountryLeagueSelections,
  getLocalLeagueQuery,
  getPrimaryLeagueValue,
} from '#/components/sportCountryLeaguePicker.helpers'

describe('SportCountryLeaguePicker helpers', () => {
  it('expands country bucket selections into concrete league values', () => {
    const expanded = expandCountryLeagueSelections(
      ['__country_england__', ALL_LEAGUES_VALUE],
      [
        { label: 'All leagues (Frontbet DB)', value: ALL_LEAGUES_VALUE },
        { label: 'ENG-Championship', value: 'ENG-Championship' },
        { label: 'ENG-Premier League', value: 'ENG-Premier League' },
        { label: 'ESP-La Liga', value: 'ESP-La Liga' },
      ],
    )

    expect(expanded).toEqual([
      ALL_LEAGUES_VALUE,
      'ENG-Championship',
      'ENG-Premier League',
    ])
  })

  it('keeps league selections unchanged when there is no country bucket', () => {
    const values = ['ENG-Championship', 'ESP-La Liga']

    expect(expandCountryLeagueSelections(values, [])).toEqual(values)
  })

  it('derives a primary league from expanded country selections', () => {
    const primaryLeague = getPrimaryLeagueValue(
      ['__country_england__', ALL_LEAGUES_VALUE],
      [
        { label: 'All leagues (Frontbet DB)', value: ALL_LEAGUES_VALUE },
        { label: 'ENG-Championship', value: 'ENG-Championship' },
        { label: 'ENG-Premier League', value: 'ENG-Premier League' },
      ],
    )

    expect(primaryLeague).toBe('Championship')
  })

  it('strips soccerdata country prefixes from league values', () => {
    expect(getLocalLeagueQuery('ENG-Premier League')).toBe('Premier League')
    expect(getLocalLeagueQuery(ALL_LEAGUES_VALUE)).toBe('')
  })
})
