import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Message {
    id: bigint;
    question: string;
    subject: Subject;
    answer: string;
    sender: Principal;
    timestamp: Time;
}
export type Time = bigint;
export interface StudyProgress {
    messages: Array<bigint>;
    questionsAsked: bigint;
    subjectsVisited: Array<Subject>;
}
export enum Subject {
    math = "math",
    history = "history",
    literature = "literature",
    science = "science"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    askQuestion(question: string, subject: Subject): Promise<Message>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getAllMessages(): Promise<Array<Message>>;
    getCallerStudyProgress(): Promise<StudyProgress>;
    getCallerUserRole(): Promise<UserRole>;
    getMessage(messageId: bigint): Promise<Message | null>;
    getMessagesByUser(user: Principal): Promise<Array<Message>>;
    /**
     * / Get subject with most questions asked
     */
    getMostPopularSubject(): Promise<Subject | null>;
    /**
     * / Calculate user with most questions asked
     */
    getMostStudiousUser(): Promise<Principal | null>;
    getStudyProgress(user: Principal): Promise<StudyProgress>;
    getSubjects(): Promise<Array<Subject>>;
    isCallerAdmin(): Promise<boolean>;
    recordStudySession(subject: Subject, questionCount: bigint): Promise<void>;
}
