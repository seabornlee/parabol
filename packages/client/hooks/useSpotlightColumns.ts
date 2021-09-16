import useAtmosphere from '~/hooks/useAtmosphere'
import {RefObject, useLayoutEffect, useState} from 'react'
import {ElementWidth} from '../types/constEnums'
import useResizeObserver from './useResizeObserver'
import {commitLocalUpdate} from 'relay-runtime'

const useSpotlightColumns = (groupsRef: RefObject<HTMLDivElement>, groupsCount: number) => {
  const [columns, setColumns] = useState<null | number[]>(null)
  const atmosphere = useAtmosphere()

  const getColumns = () => {
    const {current: el} = groupsRef
    const width = el?.clientWidth
    if (!width) return
    if (groupsCount <= 2) {
      setColumns([0])
    } else {
      const maxColumnsLargeScreen = 3
      const minColumns = 1
      const minGroupsPerColumn = 2
      const maxColumnsInRef = Math.floor(width / ElementWidth.MEETING_CARD_WITH_MARGIN)
      const maxColumns = Math.max(Math.min(maxColumnsInRef, maxColumnsLargeScreen), minColumns)
      const groupsPerColumn = Math.ceil(groupsCount / maxColumns)
      const columnsCount =
        groupsPerColumn < minGroupsPerColumn && maxColumns !== minColumns
          ? maxColumns - 1
          : maxColumns
      const newColumns = [...Array(columnsCount).keys()]
      commitLocalUpdate(atmosphere, (store) => {
        const viewer = store.getRoot().getLinkedRecord('viewer')
        viewer?.setValue(columnsCount, 'maxSpotlightColumns')
      })
      setColumns(newColumns)
    }
  }

  useLayoutEffect(getColumns, [groupsRef, groupsCount])
  useResizeObserver(getColumns, groupsRef)
  return columns
}

export default useSpotlightColumns