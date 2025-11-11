
// tipler - dtolar ->> LoginInput, RegisterInput vs.


export type ISODate = string;
export interface LoginInput
{
    email : string;
    password: string;
}

export interface RegisterInput
{
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password: string;
    acceptedTos: boolean;
}

export interface MockResult<T>{
    ok:true;
    endpoint: string;
    payload: T;
    createdAt: ISODate;
    json: string;
}

export type Role = "admin" | "dealer" | "carrier" | "restaurant";
