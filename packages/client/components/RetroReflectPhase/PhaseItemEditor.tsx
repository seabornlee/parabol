import styled from '@emotion/styled'
import {convertFromRaw, convertToRaw, EditorState} from 'draft-js'
import React, {MutableRefObject, RefObject, useEffect, useRef, useState} from 'react'
import useAtmosphere from '../../hooks/useAtmosphere'
import useMutationProps from '../../hooks/useMutationProps'
import usePortal from '../../hooks/usePortal'
import CreateReflectionMutation from '../../mutations/CreateReflectionMutation'
import EditReflectionMutation from '../../mutations/EditReflectionMutation'
import {Elevation} from '../../styles/elevation'
import {BezierCurve, ElementWidth, ZIndex} from '../../types/constEnums'
import convertToTaskContent from '../../utils/draftjs/convertToTaskContent'
import ReflectionCardRoot from '../ReflectionCard/ReflectionCardRoot'
import ReflectionEditorWrapper from '../ReflectionEditorWrapper'
import getBBox from './getBBox'
import {ReflectColumnCardInFlight} from './PhaseItemColumn'

const FLIGHT_TIME = 500
const CardInFlightStyles = styled(ReflectionCardRoot)<{
  transform: string
  isStart: boolean
  isWidthExpanded: boolean
}>(({isStart, isWidthExpanded, transform}) => ({
  boxShadow: isStart ? Elevation.Z8 : Elevation.Z0,
  position: 'absolute',
  top: 0,
  transform,
  transition: `all ${FLIGHT_TIME}ms ${BezierCurve.DECELERATE}`,
  width: isWidthExpanded ? ElementWidth.REFLECTION_CARD_EXPANDED : ElementWidth.REFLECTION_CARD,
  zIndex: ZIndex.REFLECTION_IN_FLIGHT
}))

interface Props {
  cardsInFlightRef: MutableRefObject<ReflectColumnCardInFlight[]>
  setCardsInFlight: (cards: ReflectColumnCardInFlight[]) => void
  isWidthExpanded?: boolean
  meetingId: string
  nextSortOrder: () => number
  phaseEditorRef: React.RefObject<HTMLDivElement>
  promptId: string
  stackTopRef: RefObject<HTMLDivElement>
  dataCy: string
}

const PhaseItemEditor = (props: Props) => {
  const {
    meetingId,
    nextSortOrder,
    phaseEditorRef,
    promptId,
    stackTopRef,
    cardsInFlightRef,
    setCardsInFlight,
    isWidthExpanded,
    dataCy
  } = props
  const atmosphere = useAtmosphere()
  const {onCompleted, onError, submitMutation} = useMutationProps()
  const [editorState, setEditorState] = useState(EditorState.createEmpty)
  const [isEditing, setIsEditing] = useState(false)
  const idleTimerIdRef = useRef<number>()
  const {terminatePortal, openPortal, portal} = usePortal({noClose: true, id: 'phaseItemEditor'})

  useEffect(() => {
    return () => {
      window.clearTimeout(idleTimerIdRef.current)
    }
  }, [idleTimerIdRef])

  const handleSubmit = (content) => {
    const input = {
      content,
      meetingId,
      promptId,
      sortOrder: nextSortOrder()
    }
    submitMutation()
    CreateReflectionMutation(atmosphere, {input}, {onError, onCompleted})
    const {top, left} = getBBox(phaseEditorRef.current)!
    const cardInFlight = {
      transform: `translate(${left}px,${top}px)`,
      editorState: EditorState.createWithContent(convertFromRaw(JSON.parse(content))),
      key: content,
      isStart: true
    }
    openPortal()
    setCardsInFlight([...cardsInFlightRef.current, cardInFlight])
    requestAnimationFrame(() => {
      const stackBBox = getBBox(stackTopRef.current)
      if (!stackBBox) return
      const {left, top} = stackBBox
      const idx = cardsInFlightRef.current.findIndex((card) => card.key == content)
      setCardsInFlight([
        ...cardsInFlightRef.current.slice(0, idx),
        {
          ...cardInFlight,
          isStart: false,
          transform: `translate(${left}px,${top}px)`
        },
        ...cardsInFlightRef.current.slice(idx + 1)
      ])
      setTimeout(removeCardInFlight(content), FLIGHT_TIME)
    })
    // move focus to end is very important! otherwise ghost chars appear
    setEditorState(EditorState.moveFocusToEnd(EditorState.createEmpty()))
  }

  const handleKeyDownFallback = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    const {value} = e.currentTarget
    if (!value) return
    handleSubmit(convertToTaskContent(value))
  }

  const handleKeydown = () => {
    // do not throttle based on submitting or they can't submit very quickly
    const content = editorState.getCurrentContent()
    if (!content.hasText()) return
    handleSubmit(JSON.stringify(convertToRaw(content)))
  }

  const ensureNotEditing = () => {
    if (!isEditing) return
    window.clearTimeout(idleTimerIdRef.current)
    idleTimerIdRef.current = undefined
    EditReflectionMutation(atmosphere, {isEditing: false, meetingId, promptId})
    setIsEditing(false)
  }

  const ensureEditing = () => {
    if (!isEditing) {
      EditReflectionMutation(atmosphere, {
        isEditing: true,
        meetingId,
        promptId
      })
      setIsEditing(true)
    }
    window.clearTimeout(idleTimerIdRef.current)
    idleTimerIdRef.current = window.setTimeout(() => {
      EditReflectionMutation(atmosphere, {
        isEditing: false,
        meetingId,
        promptId
      })
      setIsEditing(false)
    }, 5000)
  }

  const handleReturn = (e: React.KeyboardEvent) => {
    if (e.shiftKey) return 'not-handled'
    handleKeydown()
    return 'handled'
  }

  const removeCardInFlight = (content: string) => () => {
    const idx = cardsInFlightRef.current.findIndex((card) => card.key === content)
    if (idx === -1) return
    const nextCardsInFlight = [
      ...cardsInFlightRef.current.slice(0, idx),
      ...cardsInFlightRef.current.slice(idx + 1)
    ]
    if (nextCardsInFlight.length === 0) terminatePortal()
    setCardsInFlight(nextCardsInFlight)
  }

  const editorRef = useRef<HTMLTextAreaElement>(null)

  return (
    <>
      <ReflectionCardRoot data-cy={dataCy} ref={phaseEditorRef} isWidthExpanded={!!isWidthExpanded}>
        <ReflectionEditorWrapper
          dataCy={`${dataCy}-wrapper`}
          isPhaseItemEditor
          ariaLabel='Edit this reflection'
          editorState={editorState}
          editorRef={editorRef}
          onBlur={ensureNotEditing}
          onFocus={ensureEditing}
          handleReturn={handleReturn}
          handleKeyDownFallback={handleKeyDownFallback}
          keyBindingFn={ensureEditing}
          placeholder='My reflection… (press enter to add)'
          setEditorState={setEditorState}
        />
      </ReflectionCardRoot>
      {portal(
        <>
          {cardsInFlightRef.current.map((card) => {
            return (
              <CardInFlightStyles
                key={card.key}
                transform={card.transform}
                isStart={card.isStart}
                isWidthExpanded={!!isWidthExpanded}
                onTransitionEnd={removeCardInFlight(card.key)}
              >
                <ReflectionEditorWrapper editorState={card.editorState} readOnly />
              </CardInFlightStyles>
            )
          })}
        </>
      )}
    </>
  )
}

export default PhaseItemEditor
