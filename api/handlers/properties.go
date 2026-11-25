package handlers

import (
	"errors"
	"strconv"

	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func propertyFailure(c *gin.Context, err error) {
	var problem services.PropertyError
	if errors.As(err, &problem) {
		c.JSON(problem.Status, gin.H{"error": problem.Message})
		return
	}
	c.JSON(500, gin.H{"error": "No fue posible guardar o consultar la propiedad"})
}
func propertyID(c *gin.Context, key string) (uint, bool) {
	v, err := strconv.ParseUint(c.Param(key), 10, 32)
	if err != nil || v == 0 {
		c.JSON(400, gin.H{"error": "Identificador no válido"})
		return 0, false
	}
	return uint(v), true
}
func propertyActor(c *gin.Context) (models.User, bool) {
	actor, ok := organizationActor(c)
	if ok {
		c.Header("Cache-Control", "private, no-store")
	}
	return actor, ok
}

// One route registrar keeps production and isolated authorization fixtures aligned.
func RegisterPropertyRoutes(group *gin.RouterGroup, db *gorm.DB) {
	registerPropertyDocuments(group, db)
	group.GET("/properties", func(c *gin.Context) {
		actor, ok := propertyActor(c)
		if !ok {
			return
		}
		var filter services.PropertyFilter
		filter.Q = c.Query("q")
		for name, target := range map[string]*uint{"officeId": &filter.OfficeID, "organizationId": &filter.OrganizationID, "clientId": &filter.ClientID} {
			if v := c.Query(name); v != "" {
				n, err := strconv.ParseUint(v, 10, 32)
				if err != nil || n == 0 {
					c.JSON(400, gin.H{"error": "Filtro no válido"})
					return
				}
				*target = uint(n)
			}
		}
		filter.Page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
		filter.PageSize, _ = strconv.Atoi(c.DefaultQuery("pageSize", "20"))
		if filter.Page > 10000 {
			c.JSON(400, gin.H{"error": "Página fuera de rango"})
			return
		}
		records, total, err := services.NewPropertyService(db.WithContext(c.Request.Context())).List(actor, filter)
		if err != nil {
			propertyFailure(c, err)
			return
		}
		c.JSON(200, gin.H{"data": records, "total": total})
	})
	group.GET("/properties/:id", func(c *gin.Context) {
		actor, ok := propertyActor(c)
		if !ok {
			return
		}
		id, ok := propertyID(c, "id")
		if !ok {
			return
		}
		record, err := services.NewPropertyService(db.WithContext(c.Request.Context())).Get(actor, id)
		if err != nil {
			propertyFailure(c, err)
			return
		}
		c.JSON(200, record)
	})
	save := func(create bool) gin.HandlerFunc {
		return func(c *gin.Context) {
			actor, ok := propertyActor(c)
			if !ok {
				return
			}
			var id uint
			if !create {
				id, ok = propertyID(c, "id")
				if !ok {
					return
				}
			}
			var input services.PropertyInput
			if c.ShouldBindJSON(&input) != nil {
				c.JSON(400, gin.H{"error": "Datos de propiedad no válidos"})
				return
			}
			record, err := services.NewPropertyService(db.WithContext(c.Request.Context())).Save(actor, id, input)
			if err != nil {
				propertyFailure(c, err)
				return
			}
			status := 200
			if create {
				status = 201
			}
			c.JSON(status, record)
		}
	}
	group.POST("/properties", save(true))
	group.PUT("/properties/:id", save(false))
	owner := func(create bool) gin.HandlerFunc {
		return func(c *gin.Context) {
			actor, ok := propertyActor(c)
			if !ok {
				return
			}
			property, ok := propertyID(c, "id")
			if !ok {
				return
			}
			var id uint
			if !create {
				id, ok = propertyID(c, "ownerId")
				if !ok {
					return
				}
			}
			var input services.PropertyOwnerInput
			if c.ShouldBindJSON(&input) != nil {
				c.JSON(400, gin.H{"error": "Datos de propietario no válidos"})
				return
			}
			record, err := services.NewPropertyService(db.WithContext(c.Request.Context())).SaveOwner(actor, property, id, input)
			if err != nil {
				propertyFailure(c, err)
				return
			}
			c.JSON(200, record)
		}
	}
	group.POST("/properties/:id/owners", owner(true))
	group.PUT("/properties/:id/owners/:ownerId", owner(false))
	registry := func(create bool) gin.HandlerFunc {
		return func(c *gin.Context) {
			actor, ok := propertyActor(c)
			if !ok {
				return
			}
			property, ok := propertyID(c, "id")
			if !ok {
				return
			}
			var id uint
			if !create {
				id, ok = propertyID(c, "entryId")
				if !ok {
					return
				}
			}
			var input services.PropertyRegistryInput
			if c.ShouldBindJSON(&input) != nil {
				c.JSON(400, gin.H{"error": "Datos registrales no válidos"})
				return
			}
			record, err := services.NewPropertyService(db.WithContext(c.Request.Context())).SaveRegistry(actor, property, id, input)
			if err != nil {
				propertyFailure(c, err)
				return
			}
			c.JSON(200, record)
		}
	}
	group.POST("/properties/:id/registry", registry(true))
	group.PUT("/properties/:id/registry/:entryId", registry(false))
}
