package main

import (
	"log"
	"net/http"

	"github.com/lucsky/cuid"
	"github.com/zishang520/engine.io/v2/types"
	socketio "github.com/zishang520/socket.io/v2/socket"
)

func main() {
	c := socketio.DefaultServerOptions()
	c.SetCors(&types.Cors{
		Origin:      "*",
		Credentials: true,
	})
	io := socketio.NewServer(nil, c)

	io.On("connection", func(ss ...any) {
		socket := ss[0].(*socketio.Socket)
		log.Printf("[%s] is connected", socket.Id())

		socket.On("server-init", func(args ...any) {
			for _, room := range socket.Rooms().Keys() {
				socket.Leave(room)
			}
			ack := args[len(args)-1].(func([]any, error))
			roomID := cuid.New()
			socket.Join(socketio.Room(roomID))
			log.Printf("[%s] creates room %s\n", socket.Id(), roomID)
			ack([]any{roomID}, nil)
		})

		socket.On("client-init", func(args ...any) {
			if len(args) < 2 {
				socket.Emit("custom-error", "client-init invalid arguments")
				return
			}
			roomID, ok := args[0].(string)
			if !ok {
				socket.Emit("custom-error", "client-init invalid roomID")
				return
			}
			desc, ok := args[1].(string)
			if !ok {
				socket.Emit("custom-error", "client-init invalid description")
				return
			}
			for _, room := range socket.Rooms().Keys() {
				socket.Leave(room)
			}
			room := socketio.Room(roomID)
			set, ok := io.Sockets().Adapter().Rooms().Load(room)
			if !ok {
				socket.Emit("custom-error", "invalid roomID")
				return
			}
			n := set.Len()
			if n == 0 {
				socket.Emit("custom-error", "invalid roomID")
				return
			}
			if n > 1 {
				socket.Emit("custom-error", "room is full")
				return
			}
			socket.Join(room)
			io.Sockets().To(room).Emit("client-init", desc)
			log.Printf("[%s] joined room %s\n", socket.Id(), roomID)
		})

		socket.On("server-answer", func(args ...any) {
			if len(args) < 1 {
				socket.Emit("custom-error", "server-answer invalid arguments")
				return
			}
			desc, ok := args[0].(string)
			if !ok {
				socket.Emit("custom-error", "server-answer invalid description")
				return
			}
			rooms := socket.Rooms()
			if rooms.Len() != 1 {
				socket.Emit("custom-error", "unexpected event server-answer")
				return
			}
			room := rooms.Keys()[0]
			set, ok := io.Sockets().Adapter().Rooms().Load(room)
			if !ok || set.Len() != 2 {
				socket.Emit("custom-error", "invalid room")
				return
			}
			io.Sockets().To(room).Emit("server-answer", desc)
			log.Printf("[%s] is answered\n", socket.Id())
		})

		socket.On("ice-candidate", func(args ...any) {
			if len(args) < 1 {
				socket.Emit("custom-error", "ice-candidate invalid arguments")
				return
			}
			candidate, ok := args[0].(string)
			if !ok {
				socket.Emit("custom-error", "ice-candidate invalid candidate")
				return
			}
			rooms := socket.Rooms()
			if rooms.Len() != 1 {
				socket.Emit("custom-error", "unexpected event ice-candidate")
				return
			}
			room := rooms.Keys()[0]
			set, ok := io.Sockets().Adapter().Rooms().Load(room)
			if !ok || set.Len() != 2 {
				socket.Emit("custom-error", "invalid room")
				return
			}
			io.Sockets().To(room).Emit("ice-candidate", candidate)
			log.Printf("[%s] got ice candidate\n", socket.Id())
		})

		socket.On("disconnect", func(args ...any) {
			reason := ""
			if len(args) >= 1 {
				v, ok := args[0].(string)
				if ok {
					reason = v
				}
			}
			for _, room := range socket.Rooms().Keys() {
				io.In(room).DisconnectSockets(true)
			}
			log.Printf("[%s] is closed, reason: %s", socket.Id(), reason)
		})
	})

	http.Handle("/apiv1/stream/", io.ServeHandler(nil))
	http.Handle("/", http.FileServer(http.Dir("../asset")))

	log.Println("Serving at localhost:8000...")
	log.Fatal(http.ListenAndServe(":8000", nil))
}
