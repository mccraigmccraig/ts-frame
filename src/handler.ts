import { Effect } from "effect"
import { UnionFromTuple } from "./object_builders.ts"
import { Tagged, UPureWrapperProgram, PureWrapperProgram, PureWrapperProgramsInputTuple } from "./pure_wrapper.ts"

// to type the multi-chain handler, need something like 
// a conditional type which will look up return types from the program map object

// takes a list of EventHandlerPrograms and builds a new program which handles any of the events
// handled by the individual programs
// {
//   // get output types for any tag
//   eventPrograms: {eventTag: program}
//   program: (ev) => Effect...  
// }
//  the event type input to the program will be the union of all the handled event types,
// while the Effect types will be chosen based on the type of the event - basically the type 
// of the individual handler program for that event
// 
// maybe want a MultiEventHandlerProgram type capturing the above ... and
// which would be composable
//
// the returned program will have type:
// Effect<union-of-requirements-of-programs,
//        union-of-errors-of-programs,
//        union-of-output-types-of-programs>


// this indexes a tuple by the element's eventTagStr property
// https://stackoverflow.com/questions/54599480/typescript-tuple-type-to-object-type  
export type IndexPureWrapperProgramTuple<T extends Array<UPureWrapperProgram>> = {
    [K in T[number]['tagStr']]: Extract<T[number], { tagStr: K }>
}
// showing that this does indeed index a tuple of UPureWrapperProgram
export type X = IndexPureWrapperProgramTuple<[
    { tagStr: "foo", program: (ev: number) => Effect.Effect<never,never,number> },
    { tagStr: "bar", program: (ev: number) => Effect.Effect<never,never,number> }]>

// a bit tricky ... given a union of Tagged, and a list of UPureWrapperProgram, get the 
// return type for the handler function, which is the return type of the program
// whose tag matches the event

// use a conditional type to distribute the result type over a union of Tagged
export type DistributeEventResultTypes<I extends Tagged, Progs extends [...UPureWrapperProgram[]]> =
    IndexPureWrapperProgramTuple<Progs>[I['tag']] extends PureWrapperProgram<infer I, infer _IFxFn, infer _PFn, infer _OFxFn>
    ? ReturnType<IndexPureWrapperProgramTuple<Progs>[I['tag']]['program']>
    : never

// return a function of the union 
// of all the input types handled by the supplied UPureWrapperPrograms,
// which uses a supplied UPureWrapperProgram to handle the input,
// returning the same results as the supplied UPureWrapperProgram


// TODO - the output type needs more work - it needs to collect
// the deps and errors from all the programs
export const makeHandlerProgram =
    <EventHandlerPrograms extends [...UPureWrapperProgram[]],
        Inputs extends UnionFromTuple<PureWrapperProgramsInputTuple<EventHandlerPrograms>>>
        (eventHandlerPrograms: [...EventHandlerPrograms]):
        (i: Inputs) => DistributeEventResultTypes<Inputs, EventHandlerPrograms> => {

        const progsByEventTag = eventHandlerPrograms.reduce(
            (m, p) => { m[p.eventTagStr] = p; return m },
            {} as { [index: string]: UPureWrapperProgram })

        return (i: Inputs) => {
            const prog = progsByEventTag[i.tag]
            if (prog != undefined) {
                // so prog.program should be the resolved PureWrapperProgram - but 
                // the type is dependent on the actual type of the input
                console.log("multiProg: ", i)
                return prog.program(i) as DistributeEventResultTypes<Inputs, EventHandlerPrograms>
            } else
                throw "NoProgram for tag: " + i.tag
        }
    }