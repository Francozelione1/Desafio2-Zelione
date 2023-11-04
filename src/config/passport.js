import local from 'passport-local' //Estrategia
import passport from 'passport' //Manejador de las estrategias
import GithubStrategy from 'passport-github2'
import jwt from 'passport-jwt'
import { createHash, validatePassword } from '../utils/bcrypt.js'
import userModel from '../models/users.models.js'
import { CustomError } from '../services/customErrors.js'
import { th } from '@faker-js/faker'

//Defino la estrategia a utilizar
const LocalStrategy = local.Strategy
const JWTStrategy = jwt.Strategy
const ExtractJWT = jwt.ExtractJwt //Extractor de los headers de la consulta

export const initializePassport = () => {

    const cookieExtractor = req => {
        //{} no hay cookies != no exista mi cookie
        const token = req.cookies ? req.cookies.jwtCookie : {} //Si existen cookies, consulte por mi cookie y sino asigno {}
        return token
    }

    passport.use('jwt', new JWTStrategy({
        jwtFromRequest: ExtractJWT.fromExtractors([cookieExtractor]), //Consulto el token de las cookies
        secretOrKey: process.env.JWT_SECRET
    }, async (jwt_payload, done) => {
        try {
            return done(null, jwt_payload.user) //Retorno el user que me genera el token
        } catch (error) {
            return done(error.message)
        }

    }))


    //done es como si fuera un res.status(), el callback de respuesta
    passport.use('register', new LocalStrategy(
        { passReqToCallback: true, usernameField: 'email' }, async (req, username, password , done) => { //Defino como voy a registrar un user // Defino que mi username va a ser el email

            try {
                const { first_name, last_name, email, age } = req.body

                if(!first_name || !last_name || !email || !age){
                    throw CustomError.createError("Error", "Error en los datos ingresados", "Faltan datos", 1)
                }
                const usuarioExistente = await userModel.findOne({ email: username })
                if (usuarioExistente) {
                    //throw CustomError.createError("Error", "Ya existe un usuario con ese nombre", "Usuario ya existente", 3)
                    return done(null, false, { message: 'Usuario ya existente' }) // el primer parametro es el error (no hay, por eso el null), el segundo es el resultado de la creacion del usuario y el tercero es el mensaje
                }
                else {
                    const contraseñaEncriptada = createHash(password)
                    const usuarioCreado = await userModel.create({
                        first_name: first_name,
                        last_name: last_name,
                        email: email,
                        password: contraseñaEncriptada,
                        age: age
                    })

                    /*if(!usuarioCreado){
                        throw CustomError.createError("Error", "Error en la base de datos", "No se pudo crear el usuario", 2)
                    }*/

                    req.nombre = usuarioCreado.first_name
                    return done(null, usuarioCreado)
                }
            } catch (error) {
                return done(null, error.message)
            }
        }
    ))

    passport.use("login", new LocalStrategy({passReqToCallback: true ,usernameField: 'email' }, async (req,username, password, done) =>{  //Defino como voy a loguear un user

        try {    
            const user = await userModel.findOne({ email: username });
    
            if (!user) {
               return done(null, false, { message: 'Usuario no encontrado' })
            }

            if (validatePassword(password, user.password)) { // Valido la contraseña
               req.nombre = user.first_name 
               req.user = user
               return done(null, user)
            }
            else{
                throw CustomError.createError("Error", "No se ingresó la contraseña correcta para ese usuario", "Contraseña incorrecta", 3)
            }
            
            //return done(null, false, { message: 'Contraseña incorrecta' }) // Contraseña invalida
           
        } catch (error) {
           return done(null, error.message)
        }

    }))

    passport.use("github", new GithubStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: process.env.CALLBACK_URL
    }, async (accessToken, refreshToken, profile, done) => {

        try{

            const user = await userModel.findOne({ email: profile._json.email })
            if (!user) {
                const usuarioCreado = await userModel.create({
                    first_name: profile._json.name,
                    last_name: ' ',
                    email: profile._json.email,
                    age: 18, //Edad por defecto ya que no la sabemos
                    password: "password"
                })
                return done(null, usuarioCreado)
            }
            else {
                return done(null, user)
            }

        }
        catch(error){
            return done(null, error.message)
        }

    }))

    passport.serializeUser((user, done) => { //Activar la session del user
        console.log(user);
        done(null, user._id)
    })
    
    passport.deserializeUser(async (id, done) => { //Eliminar la session del user
        const user = await userModel.findById(id)
        done(null, user)
    })


}